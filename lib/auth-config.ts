import type { Adapter } from "@auth/core/adapters";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { PrismaClient } from "@prisma/client";
import type { NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAuthRuntimeConfig, type AuthRuntimeConfig } from "@/lib/env";

const credentialsSchema = z.object({
  email: z.string().email()
});

type AuthAdapterClient = Pick<
  typeof prisma,
  "user" | "authAccount" | "session" | "verificationToken"
>;

export function buildAuthConfig(env: NodeJS.ProcessEnv = process.env): NextAuthConfig {
  const runtimeConfig = getAuthRuntimeConfig(env);

  return {
    adapter: createWealthOSPrismaAdapter(),
    secret: runtimeConfig.authSecret,
    trustHost: runtimeConfig.trustHost,
    useSecureCookies: runtimeConfig.authUrl?.startsWith("https://") ?? runtimeConfig.nodeEnv === "production",
    session: {
      strategy: "database",
      maxAge: runtimeConfig.sessionMaxAgeSeconds,
      updateAge: runtimeConfig.sessionUpdateAgeSeconds
    },
    providers: buildAuthProviders(runtimeConfig),
    callbacks: {
      async signIn({ user }) {
        if (!user.email) {
          return false;
        }

        const existing = await prisma.user.findUnique({
          where: {
            email: user.email
          },
          select: {
            deletedAt: true
          }
        });

        return existing?.deletedAt ? false : true;
      },
      session({ session, user }) {
        if (session.user) {
          session.user.id = user.id;
        }

        return session;
      }
    }
  };
}

export function buildAuthProviders(
  config: AuthRuntimeConfig,
  client: Pick<typeof prisma, "user"> = prisma
): Provider[] {
  const providers: Provider[] = [];

  if (config.google) {
    providers.push(
      Google({
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret
      })
    );
  }

  if (config.email) {
    providers.push(
      Nodemailer({
        server: config.email.server,
        from: config.email.from,
        maxAge: 10 * 60
      })
    );
  }

  if (config.enableDevelopmentCredentials) {
    providers.push(
      Credentials({
        id: "development-email",
        name: "Development Email",
        credentials: {
          email: { label: "Email", type: "email" }
        },
        async authorize(credentials) {
          const parsed = credentialsSchema.safeParse(credentials);

          if (!parsed.success) {
            return null;
          }

          const user = await client.user.upsert({
            where: {
              email: parsed.data.email
            },
            update: {},
            create: {
              email: parsed.data.email
            }
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name
          };
        }
      })
    );
  }

  return providers;
}

export function createWealthOSPrismaAdapter(client: AuthAdapterClient = prisma): Adapter {
  return PrismaAdapter({
    user: client.user,
    account: client.authAccount,
    session: client.session,
    verificationToken: client.verificationToken
  } as unknown as PrismaClient);
}

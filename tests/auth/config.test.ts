import { describe, expect, it, vi } from "vitest";
import {
  buildAuthProviders,
  createWealthOSPrismaAdapter
} from "@/lib/auth-config";
import type { AuthRuntimeConfig } from "@/lib/env";

const baseConfig: AuthRuntimeConfig = {
  nodeEnv: "production",
  databaseUrl: "postgresql://wealthos:secret@localhost:5432/wealthos",
  authSecret: "x".repeat(32),
  authUrl: "https://wealthos.example.com",
  trustHost: false,
  enableDevelopmentCredentials: false,
  sessionMaxAgeSeconds: 30 * 24 * 60 * 60,
  sessionUpdateAgeSeconds: 24 * 60 * 60
};

describe("auth configuration", () => {
  it("configures Google and email providers for production auth", () => {
    const providers = buildAuthProviders({
      ...baseConfig,
      google: {
        clientId: "google-client-id",
        clientSecret: "google-client-secret"
      },
      email: {
        server: "smtp://user:pass@smtp.example.com:587",
        from: "WealthOS <security@example.com>"
      }
    });

    expect(providers.map(providerId)).toEqual(["google", "nodemailer"]);
  });

  it("keeps development credentials out of production", () => {
    const providers = buildAuthProviders(baseConfig);

    expect(providers).toEqual([]);
  });

  it("allows development email credentials only when explicitly enabled by runtime config", () => {
    const providers = buildAuthProviders({
      ...baseConfig,
      nodeEnv: "development",
      enableDevelopmentCredentials: true
    });

    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({
      id: "credentials",
      type: "credentials"
    });
  });

  it("maps Auth.js account adapter operations to the renamed Prisma authAccount model", async () => {
    const authAccountCreateMock = vi.fn().mockResolvedValue({
      userId: "user-1",
      provider: "google",
      providerAccountId: "google-user-1"
    });
    const adapter = createWealthOSPrismaAdapter({
      user: {},
      authAccount: {
        create: authAccountCreateMock
      },
      session: {},
      verificationToken: {}
    } as never);

    await adapter.linkAccount?.({
      userId: "user-1",
      type: "oidc",
      provider: "google",
      providerAccountId: "google-user-1"
    });

    expect(authAccountCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        provider: "google",
        providerAccountId: "google-user-1"
      })
    });
  });
});

function providerId(provider: unknown) {
  return (provider as { id?: string }).id;
}

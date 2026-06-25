import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function requireAuthenticatedSession() {
  const session = await auth();

  if (!session?.user?.id || isSessionExpired(session)) {
    redirect("/api/auth/signin");
  }

  return session;
}

export function isSessionExpired(session: Pick<Session, "expires">, now = new Date()) {
  return new Date(session.expires).getTime() <= now.getTime();
}

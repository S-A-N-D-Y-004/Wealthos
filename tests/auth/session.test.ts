import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSessionExpired,
  requireAuthenticatedSession
} from "@/lib/auth-session";

const authMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((url: string) => {
  throw new Error(`redirect:${url}`);
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

describe("authenticated session guard", () => {
  beforeEach(() => {
    authMock.mockReset();
    redirectMock.mockClear();
  });

  it("detects expired sessions deterministically", () => {
    const now = new Date("2026-06-25T12:00:00.000Z");

    expect(isSessionExpired({ expires: "2026-06-25T11:59:59.999Z" }, now)).toBe(true);
    expect(isSessionExpired({ expires: "2026-06-25T12:00:00.001Z" }, now)).toBe(false);
  });

  it("redirects unauthenticated page requests to the Auth.js sign-in endpoint", async () => {
    authMock.mockResolvedValue(null);

    await expect(requireAuthenticatedSession()).rejects.toThrow("redirect:/api/auth/signin");
    expect(redirectMock).toHaveBeenCalledWith("/api/auth/signin");
  });

  it("redirects expired sessions", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user-1"
      },
      expires: "2000-01-01T00:00:00.000Z"
    });

    await expect(requireAuthenticatedSession()).rejects.toThrow("redirect:/api/auth/signin");
    expect(redirectMock).toHaveBeenCalledWith("/api/auth/signin");
  });

  it("returns active authenticated sessions", async () => {
    const session = {
      user: {
        id: "user-1"
      },
      expires: "2999-01-01T00:00:00.000Z"
    };
    authMock.mockResolvedValue(session);

    await expect(requireAuthenticatedSession()).resolves.toBe(session);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

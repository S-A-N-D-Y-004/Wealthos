import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/dashboard/route";

const authMock = vi.hoisted(() => vi.fn());
const getDashboardProjectionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: authMock
}));

vi.mock("@/lib/db", () => ({
  prisma: {}
}));

vi.mock("@/lib/dashboard/projections", () => ({
  getDashboardProjection: getDashboardProjectionMock
}));

describe("dashboard API route", () => {
  beforeEach(() => {
    authMock.mockReset();
    getDashboardProjectionMock.mockReset();
  });

  it("rejects unauthenticated dashboard reads", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      success: false,
      error: {
        code: "UNAUTHORIZED"
      }
    });
    expect(getDashboardProjectionMock).not.toHaveBeenCalled();
  });

  it("loads dashboard projections for the authenticated user only", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user-1"
      }
    });
    getDashboardProjectionMock.mockResolvedValue({
      netWorth: {
        netWorthMinor: 12345
      }
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getDashboardProjectionMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1"
    }));
    expect(body).toEqual({
      success: true,
      data: {
        netWorth: {
          netWorthMinor: 12345
        }
      }
    });
  });
});

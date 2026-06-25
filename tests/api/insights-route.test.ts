import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/insights/route";

const authMock = vi.hoisted(() => vi.fn());
const buildLedgerDashboardDataMock = vi.hoisted(() => vi.fn());
const generateAndPersistPeriodicInsightsMock = vi.hoisted(() => vi.fn());
const generateAndPersistCoachResponseMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: authMock
}));

vi.mock("@/lib/db", () => ({
  prisma: {}
}));

vi.mock("@/lib/dashboard/ledger-dashboard", () => ({
  buildLedgerDashboardData: buildLedgerDashboardDataMock
}));

vi.mock("@/lib/ai", () => ({
  createDeterministicFinancialCoachProvider: () => ({ name: "deterministic" }),
  generateAndPersistCoachResponse: generateAndPersistCoachResponseMock,
  generateAndPersistPeriodicInsights: generateAndPersistPeriodicInsightsMock
}));

describe("insights API route", () => {
  beforeEach(() => {
    authMock.mockReset();
    buildLedgerDashboardDataMock.mockReset();
    generateAndPersistPeriodicInsightsMock.mockReset();
    generateAndPersistCoachResponseMock.mockReset();
  });

  it("rejects unauthenticated reads", async () => {
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
  });

  it("keeps GET read-only and does not persist generated insights", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    buildLedgerDashboardDataMock.mockResolvedValue({
      insights: [
        {
          id: "insight-1",
          title: "Existing insight"
        }
      ]
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        status: "ready",
        insights: [
          {
            id: "insight-1",
            title: "Existing insight"
          }
        ]
      }
    });
    expect(generateAndPersistPeriodicInsightsMock).not.toHaveBeenCalled();
    expect(generateAndPersistCoachResponseMock).not.toHaveBeenCalled();
  });

  it("handles malformed POST JSON gracefully", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(new Request("http://wealthos.test/api/insights", {
      method: "POST",
      body: "{not-json",
      headers: {
        "content-type": "application/json"
      }
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request body must be valid JSON."
      }
    });
    expect(generateAndPersistCoachResponseMock).not.toHaveBeenCalled();
  });

  it("moves periodic insight persistence to POST", async () => {
    const generatedAt = new Date("2026-06-25T00:00:00.000Z");

    authMock.mockResolvedValue({ user: { id: "user-1" } });
    generateAndPersistPeriodicInsightsMock.mockResolvedValue({
      provider: "deterministic",
      generatedAt,
      persistedCount: 1,
      insights: [{ id: "insight-1" }]
    });

    const response = await POST(jsonRequest({ mode: "periodic" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(generateAndPersistPeriodicInsightsMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1"
    }));
    expect(body).toMatchObject({
      success: true,
      data: {
        provider: "deterministic",
        status: "generated",
        persistedCount: 1,
        insights: [{ id: "insight-1" }]
      }
    });
  });
});

function jsonRequest(body: unknown) {
  return new Request("http://wealthos.test/api/insights", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json"
    }
  });
}

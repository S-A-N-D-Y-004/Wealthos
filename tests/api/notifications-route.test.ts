import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "@/app/api/notifications/route";

const authMock = vi.hoisted(() => vi.fn());
const getNotificationAggregationMock = vi.hoisted(() => vi.fn());
const evaluateAndPersistAlertsMock = vi.hoisted(() => vi.fn());
const markAlertsReadMock = vi.hoisted(() => vi.fn());
const markAlertsUnreadMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: authMock
}));

vi.mock("@/lib/db", () => ({
  prisma: {}
}));

vi.mock("@/lib/alerts", () => ({
  evaluateAndPersistAlerts: evaluateAndPersistAlertsMock,
  getNotificationAggregation: getNotificationAggregationMock,
  markAlertsRead: markAlertsReadMock,
  markAlertsUnread: markAlertsUnreadMock
}));

describe("notifications API route", () => {
  beforeEach(() => {
    authMock.mockReset();
    getNotificationAggregationMock.mockReset();
    evaluateAndPersistAlertsMock.mockReset();
    markAlertsReadMock.mockReset();
    markAlertsUnreadMock.mockReset();
  });

  it("rejects unauthenticated notification reads", async () => {
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

  it("handles malformed PATCH JSON gracefully", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await PATCH(new Request("http://wealthos.test/api/notifications", {
      method: "PATCH",
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
    expect(markAlertsReadMock).not.toHaveBeenCalled();
    expect(markAlertsUnreadMock).not.toHaveBeenCalled();
  });

  it("validates notification update actions", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await PATCH(jsonRequest({ action: "archive" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Notification update request failed validation."
      }
    });
  });

  it("returns a standardized success envelope for read updates", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    markAlertsReadMock.mockResolvedValue({ count: 2 });

    const response = await PATCH(jsonRequest({
      action: "mark-read",
      alertIds: ["alert-1", "alert-2"]
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(markAlertsReadMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      alertIds: ["alert-1", "alert-2"]
    }));
    expect(body).toEqual({
      success: true,
      data: {
        updated: 2
      }
    });
  });
});

function jsonRequest(body: unknown) {
  return new Request("http://wealthos.test/api/notifications", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json"
    }
  });
}

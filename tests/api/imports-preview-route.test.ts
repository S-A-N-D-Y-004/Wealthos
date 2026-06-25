import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/imports/preview/route";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: authMock
}));

describe("imports preview API route", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it("rejects unauthenticated import preview requests", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(jsonRequest({ source: "COINDCX", csv: "date,market,side,quantity,price,total" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      success: false,
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  it("handles malformed JSON gracefully", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(new Request("http://wealthos.test/api/imports/preview", {
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
  });

  it("enforces a request body size limit", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(jsonRequest({
      source: "COINDCX",
      csv: "x".repeat(2 * 1024 * 1024)
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request body exceeds the 2 MiB limit."
      }
    });
  });

  it("returns a standardized success envelope", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(jsonRequest({
      source: "COINDCX",
      csv: [
        "date,market,side,quantity,price,total",
        "2026-06-25,BTCINR,BUY,0.1,5000000,500000"
      ].join("\n")
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        detectedRows: 1,
        validRows: 1,
        rejectedRows: 0
      }
    });
  });
});

function jsonRequest(body: unknown) {
  return new Request("http://wealthos.test/api/imports/preview", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json"
    }
  });
}

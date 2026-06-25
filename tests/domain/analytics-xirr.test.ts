import { describe, expect, it } from "vitest";
import {
  calculateMoneyWeightedReturn,
  calculateXirr,
  calculateXnpv,
  type XirrResult
} from "@/lib/domain/analytics";

describe("XIRR and money-weighted returns", () => {
  it("calculates a standard irregular XIRR example", () => {
    const cashFlows = [
      cashFlow(-1000000, "2025-01-01"),
      cashFlow(275000, "2025-03-01"),
      cashFlow(425000, "2025-10-30"),
      cashFlow(325000, "2026-02-15"),
      cashFlow(275000, "2026-04-01")
    ];
    const result = expectXirrSuccess(calculateXirr({ cashFlows }));

    expect(result.xirrPercent).toBe(37.5);
    expect(result.method).toBe("NEWTON_RAPHSON");
    expect(Math.round(calculateXnpv(cashFlows, result.rate))).toBe(0);
  });

  it("calculates one-time investment money-weighted return", () => {
    const result = expectXirrSuccess(calculateMoneyWeightedReturn({
      cashFlows: [
        cashFlow(-100000, "2025-01-01T00:00:00.000Z")
      ],
      currentValueMinor: 121000,
      valuationDate: new Date("2026-01-01T06:00:00.000Z")
    }));

    expect(result.xirrPercent).toBe(21);
    expect(result.moneyWeightedReturnPercent).toBe(21);
  });

  it("calculates SIP-style monthly investing returns", () => {
    const monthlyInvestments = Array.from({ length: 12 }, (_, index) =>
      cashFlow(-10000, `2025-${String(index + 1).padStart(2, "0")}-01`)
    );
    const result = expectXirrSuccess(calculateMoneyWeightedReturn({
      cashFlows: monthlyInvestments,
      currentValueMinor: 132000,
      valuationDate: new Date("2026-01-01T00:00:00.000Z")
    }));

    expect(result.moneyWeightedReturnPercent).toBe(18.9);
  });

  it("supports partial withdrawals before final valuation", () => {
    const result = expectXirrSuccess(calculateMoneyWeightedReturn({
      cashFlows: [
        cashFlow(-100000, "2025-01-01"),
        cashFlow(25000, "2025-07-01")
      ],
      currentValueMinor: 90000,
      valuationDate: new Date("2026-01-01T00:00:00.000Z")
    }));

    expect(result.moneyWeightedReturnPercent).toBe(17.1);
  });

  it("supports multiple withdrawals", () => {
    const result = expectXirrSuccess(calculateXirr({
      cashFlows: [
        cashFlow(-100000, "2025-01-01"),
        cashFlow(10000, "2025-04-01"),
        cashFlow(15000, "2025-08-01"),
        cashFlow(95000, "2026-01-01")
      ]
    }));

    expect(result.xirrPercent).toBe(23.1);
  });

  it("calculates negative overall returns", () => {
    const result = expectXirrSuccess(calculateMoneyWeightedReturn({
      cashFlows: [
        cashFlow(-100000, "2025-01-01T00:00:00.000Z")
      ],
      currentValueMinor: 80000,
      valuationDate: new Date("2026-01-01T06:00:00.000Z")
    }));

    expect(result.moneyWeightedReturnPercent).toBe(-20);
  });

  it("calculates positive leap-year returns", () => {
    const result = expectXirrSuccess(calculateXirr({
      cashFlows: [
        cashFlow(-100000, "2020-02-29"),
        cashFlow(146410, "2024-02-29")
      ]
    }));

    expect(result.xirrPercent).toBe(10);
  });

  it("handles extremely long investment periods", () => {
    const result = expectXirrSuccess(calculateXirr({
      cashFlows: [
        cashFlow(-100000, "1986-01-01"),
        cashFlow(704000, "2026-01-01")
      ]
    }));

    expect(result.xirrPercent).toBe(5);
  });

  it("returns deterministic validation errors for invalid cash flows", () => {
    expect(calculateXirr({ cashFlows: [] })).toMatchObject({
      ok: false,
      error: {
        code: "INSUFFICIENT_CASH_FLOWS"
      }
    });
    expect(calculateXirr({
      cashFlows: [
        cashFlow(10000, "2025-01-01"),
        cashFlow(12000, "2026-01-01")
      ]
    })).toMatchObject({
      ok: false,
      error: {
        code: "MISSING_NEGATIVE_CASH_FLOW"
      }
    });
    expect(calculateXirr({
      cashFlows: [
        cashFlow(-10000, "2025-01-01"),
        cashFlow(-12000, "2026-01-01")
      ]
    })).toMatchObject({
      ok: false,
      error: {
        code: "MISSING_POSITIVE_CASH_FLOW"
      }
    });
    expect(calculateXirr({
      cashFlows: [
        null,
        cashFlow(-10000, "2025-01-01"),
        cashFlow(12000, "2026-01-01")
      ] as never
    })).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_CASH_FLOWS"
      }
    });
    expect(calculateXirr({
      cashFlows: [
        cashFlow(-10000, "2025-01-01"),
        cashFlow(12000, "2026-01-01")
      ],
      guessPercent: Number.NaN
    })).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_OPTIONS"
      }
    });
    expect(calculateMoneyWeightedReturn({
      cashFlows: "not-an-array" as never
    })).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_CASH_FLOWS"
      },
      moneyWeightedReturnPercent: 0
    });
  });

  it("rejects identical dates deterministically", () => {
    expect(calculateXirr({
      cashFlows: [
        cashFlow(-100000, "2025-01-01"),
        cashFlow(125000, "2025-01-01")
      ]
    })).toMatchObject({
      ok: false,
      error: {
        code: "IDENTICAL_DATES"
      }
    });
  });

  it("handles zero terminal values without throwing", () => {
    expect(calculateMoneyWeightedReturn({
      cashFlows: [
        cashFlow(-100000, "2025-01-01")
      ],
      currentValueMinor: 0,
      valuationDate: new Date("2026-01-01T00:00:00.000Z")
    })).toMatchObject({
      ok: false,
      error: {
        code: "INSUFFICIENT_CASH_FLOWS"
      },
      moneyWeightedReturnPercent: 0
    });
  });

  it("detects impossible solutions that do not bracket a root", () => {
    expect(calculateXirr({
      cashFlows: [
        cashFlow(-100000, "2025-01-01"),
        cashFlow(1000, "2025-07-01"),
        cashFlow(-100000, "2026-01-01")
      ]
    })).toMatchObject({
      ok: false,
      error: {
        code: "NO_SOLUTION"
      }
    });
  });

  it("returns no-convergence when iteration limits are too low", () => {
    expect(calculateXirr({
      cashFlows: [
        cashFlow(-100000, "2025-01-01"),
        cashFlow(121000, "2026-01-01")
      ],
      maxIterations: 1,
      tolerance: 0.000000000001
    })).toMatchObject({
      ok: false,
      error: {
        code: "NO_CONVERGENCE"
      }
    });
  });

  it("keeps rounded percent output stable", () => {
    const result = expectXirrSuccess(calculateXirr({
      cashFlows: [
        cashFlow(-300, "2025-01-01"),
        cashFlow(400, "2026-01-01T06:00:00.000Z")
      ]
    }));

    expect(result.xirrPercent).toBe(33.3);
  });
});

function cashFlow(amountMinor: number, date: string) {
  return {
    amountMinor,
    occurredAt: new Date(date)
  };
}

function expectXirrSuccess<T extends XirrResult>(result: T) {
  expect(result).toMatchObject({
    ok: true,
    converged: true
  });

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result;
}

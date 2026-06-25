import { describe, expect, it } from "vitest";
import {
  calculateAbsoluteReturn,
  calculateAbsoluteReturnPercent,
  calculateAnnualizedReturnPercent,
  calculateCagrPercent,
  calculateInvestmentPeriodYears,
  calculateNetInvestedAmount,
  calculateSimpleAnnualizedReturnPercent,
  resolveAnalyticsTimeRange,
  summarizeHoldingReturns,
  summarizePortfolioReturns,
  type PortfolioReturnCashFlow
} from "@/lib/domain/analytics";
import type { HoldingInput } from "@/lib/domain/models";

const ONE_YEAR = {
  startDate: new Date("2025-01-01T00:00:00.000Z"),
  endDate: new Date("2026-01-01T06:00:00.000Z")
};

describe("portfolio return calculations", () => {
  it("calculates positive absolute return and return percentage", () => {
    const input = {
      investedAmountMinor: 100000,
      currentValueMinor: 125000
    };

    expect(calculateAbsoluteReturn(input)).toBe(25000);
    expect(calculateAbsoluteReturnPercent(input)).toBe(25);
  });

  it("calculates negative absolute return and return percentage", () => {
    const input = {
      investedAmountMinor: 100000,
      currentValueMinor: 80000
    };

    expect(calculateAbsoluteReturn(input)).toBe(-20000);
    expect(calculateAbsoluteReturnPercent(input)).toBe(-20);
  });

  it("returns zero percentage for zero investment", () => {
    expect(calculateAbsoluteReturnPercent({
      investedAmountMinor: 0,
      currentValueMinor: 50000
    })).toBe(0);
  });

  it("rounds return percentages consistently to one decimal place", () => {
    expect(calculateAbsoluteReturnPercent({
      investedAmountMinor: 300,
      currentValueMinor: 400
    })).toBe(33.3);
  });

  it("calculates CAGR and annualized return for a single investment", () => {
    const input = {
      investedAmountMinor: 100000,
      currentValueMinor: 121000,
      ...ONE_YEAR
    };

    expect(calculateCagrPercent(input)).toBe(21);
    expect(calculateAnnualizedReturnPercent(input)).toBe(21);
    expect(calculateSimpleAnnualizedReturnPercent(input)).toBe(21);
  });

  it("calculates CAGR for negative returns", () => {
    expect(calculateCagrPercent({
      investedAmountMinor: 100000,
      currentValueMinor: 81000,
      startDate: new Date("2024-02-29T00:00:00.000Z"),
      endDate: new Date("2026-02-28T12:00:00.000Z")
    })).toBe(-10);
  });

  it("handles invalid and identical CAGR dates gracefully", () => {
    expect(calculateCagrPercent({
      investedAmountMinor: 100000,
      currentValueMinor: 110000,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-01T00:00:00.000Z")
    })).toBe(0);
    expect(calculateCagrPercent({
      investedAmountMinor: 100000,
      currentValueMinor: 110000,
      startDate: new Date("not-a-date"),
      endDate: new Date("2026-01-01T00:00:00.000Z")
    })).toBe(0);
  });

  it("calculates long holding periods deterministically", () => {
    expect(calculateCagrPercent({
      investedAmountMinor: 100000,
      currentValueMinor: 259374,
      startDate: new Date("2016-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-01T00:00:00.000Z")
    })).toBe(10);
  });

  it("uses leap-year aware investment periods", () => {
    expect(calculateInvestmentPeriodYears(
      new Date("2020-02-29T00:00:00.000Z"),
      new Date("2024-02-29T00:00:00.000Z")
    )).toBe(4);
    expect(calculateCagrPercent({
      investedAmountMinor: 100000,
      currentValueMinor: 146410,
      startDate: new Date("2020-02-29T00:00:00.000Z"),
      endDate: new Date("2024-02-29T00:00:00.000Z")
    })).toBe(10);
  });

  it("returns a zero-state portfolio summary for empty portfolios", () => {
    expect(summarizePortfolioReturns({
      positions: [],
      ...ONE_YEAR
    })).toEqual({
      investedAmountMinor: 0,
      currentValueMinor: 0,
      gainLossMinor: 0,
      gainLossPercent: 0,
      annualizedReturnPercent: 0,
      cagrPercent: 0,
      period: ONE_YEAR
    });
  });

  it("summarizes multiple investment positions", () => {
    const summary = summarizePortfolioReturns({
      positions: [
        {
          id: "equity",
          investedAmountMinor: 100000,
          currentValueMinor: 150000,
          investedAt: ONE_YEAR.startDate
        },
        {
          id: "gold",
          investedAmountMinor: 50000,
          currentValueMinor: 45000,
          investedAt: ONE_YEAR.startDate
        }
      ],
      endDate: ONE_YEAR.endDate
    });

    expect(summary).toMatchObject({
      investedAmountMinor: 150000,
      currentValueMinor: 195000,
      gainLossMinor: 45000,
      gainLossPercent: 30,
      annualizedReturnPercent: 30,
      cagrPercent: 30
    });
    expect(summary.period.startDate?.toISOString()).toBe(ONE_YEAR.startDate.toISOString());
  });

  it("supports partial withdrawals through net invested cash flows", () => {
    const cashFlows: PortfolioReturnCashFlow[] = [
      {
        type: "INVESTMENT",
        amountMinor: 100000,
        occurredAt: ONE_YEAR.startDate
      },
      {
        type: "WITHDRAWAL",
        amountMinor: 25000,
        occurredAt: new Date("2025-07-01T00:00:00.000Z")
      }
    ];
    const summary = summarizePortfolioReturns({
      cashFlows,
      currentValueMinor: 90000,
      endDate: ONE_YEAR.endDate
    });

    expect(calculateNetInvestedAmount(cashFlows)).toBe(75000);
    expect(summary).toMatchObject({
      investedAmountMinor: 75000,
      currentValueMinor: 90000,
      gainLossMinor: 15000,
      gainLossPercent: 20
    });
    expect(summary.period.startDate?.toISOString()).toBe(ONE_YEAR.startDate.toISOString());
  });

  it("summarizes derived holdings without re-deriving ledger state", () => {
    const summary = summarizeHoldingReturns([
      holding({
        id: "holding-1",
        costBasisMinor: 100000,
        currentValueMinor: 150000
      }),
      holding({
        id: "holding-2",
        costBasisMinor: 40000,
        currentValueMinor: 30000
      })
    ], ONE_YEAR);

    expect(summary).toMatchObject({
      investedAmountMinor: 140000,
      currentValueMinor: 180000,
      gainLossMinor: 40000,
      gainLossPercent: 28.6
    });
  });

  it("resolves supported analytics time ranges", () => {
    const asOf = new Date("2026-06-30T00:00:00.000Z");

    expect(resolveAnalyticsTimeRange({ kind: "SINCE_INCEPTION" }, asOf)).toEqual({
      kind: "SINCE_INCEPTION",
      startDate: undefined,
      endDate: asOf
    });
    expect(resolveAnalyticsTimeRange({ kind: "ONE_MONTH" }, asOf).startDate?.toISOString())
      .toBe("2026-05-30T00:00:00.000Z");
    expect(resolveAnalyticsTimeRange({ kind: "THREE_MONTHS" }, asOf).startDate?.toISOString())
      .toBe("2026-03-30T00:00:00.000Z");
    expect(resolveAnalyticsTimeRange({ kind: "SIX_MONTHS" }, asOf).startDate?.toISOString())
      .toBe("2025-12-30T00:00:00.000Z");
    expect(resolveAnalyticsTimeRange({ kind: "ONE_YEAR" }, asOf).startDate?.toISOString())
      .toBe("2025-06-30T00:00:00.000Z");
    expect(resolveAnalyticsTimeRange({
      kind: "CUSTOM",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: asOf
    })).toEqual({
      kind: "CUSTOM",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: asOf
    });
  });

  it("keeps portfolio summary calculations independent from money-weighted returns", () => {
    const summary = summarizePortfolioReturns({
      cashFlows: [
        {
          type: "INVESTMENT",
          amountMinor: 100000,
          occurredAt: ONE_YEAR.startDate
        }
      ],
      currentValueMinor: 121000,
      endDate: ONE_YEAR.endDate
    });

    expect(summary.cagrPercent).toBe(21);
    expect(summary.annualizedReturnPercent).toBe(21);
  });
});

function holding(input: Pick<HoldingInput, "id" | "costBasisMinor" | "currentValueMinor">): HoldingInput {
  return {
    accountName: "Broker",
    source: "Manual",
    assetName: input.id,
    assetClass: "Equity",
    assetType: "ETF",
    quantity: 1,
    averageCostMinor: input.costBasisMinor,
    currentPriceMinor: input.currentValueMinor,
    currency: "INR",
    ...input
  };
}

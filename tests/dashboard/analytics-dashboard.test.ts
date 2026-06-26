import { describe, expect, it } from "vitest";
import {
  buildAnalyticsDashboardData,
  selectAnalyticsTimeRange
} from "@/lib/dashboard/analytics-dashboard";
import {
  createZeroDashboardData,
  type LedgerDashboardData
} from "@/lib/dashboard/ledger-dashboard";
import { buildNetWorthTrend, calculateNetWorth } from "@/lib/domain/calculations/net-worth";
import type { LedgerTransactionType } from "@/lib/domain/ledger";
import type { HoldingInput } from "@/lib/domain/models";

const asOf = new Date("2026-06-30T00:00:00.000Z");

describe("analytics dashboard adapter", () => {
  it("returns deterministic empty portfolio analytics", () => {
    const analytics = buildAnalyticsDashboardData(createZeroDashboardData(asOf), { asOf });
    const selected = selectAnalyticsTimeRange(analytics, "SINCE_INCEPTION");

    expect(analytics.isEmpty).toBe(true);
    expect(selected.overview).toEqual({
      currentPortfolioValueMinor: 0,
      totalInvestedMinor: 0,
      totalGainLossMinor: 0,
      absoluteReturnPercent: 0,
      annualizedReturnPercent: 0,
      cagrPercent: 0,
      xirrPercent: 0,
      moneyWeightedReturnPercent: 0
    });
    expect(selected.risk).toEqual({
      riskRating: "Very Low",
      diversificationScore: 0,
      volatilityPercent: 0,
      maximumDrawdownPercent: 0,
      largestHoldingPercent: 0,
      concentrationLevel: "Low",
      hhi: 0
    });
    expect(selected.charts.portfolioGrowth).toEqual([]);
    expect(selected.charts.monthlyReturns).toEqual([]);
    expect(analytics.allocations.topHoldings).toEqual([]);
  });

  it("builds overview, risk, and allocation data from ledger dashboard projections", () => {
    const analytics = buildAnalyticsDashboardData(populatedDashboard(), { asOf });
    const selected = selectAnalyticsTimeRange(analytics, "SINCE_INCEPTION");

    expect(analytics.isEmpty).toBe(false);
    expect(selected.overview).toMatchObject({
      currentPortfolioValueMinor: 175000,
      totalInvestedMinor: 150000,
      totalGainLossMinor: 25000,
      absoluteReturnPercent: 16.7
    });
    expect(selected.overview.cagrPercent).toBeGreaterThan(0);
    expect(selected.overview.xirrPercent).toBeGreaterThan(0);
    expect(selected.overview.moneyWeightedReturnPercent).toBe(selected.overview.xirrPercent);
    expect(selected.risk.concentrationLevel).toBe("High");
    expect(selected.risk.largestHoldingPercent).toBe(74.3);
    expect(selected.charts.assetAllocation.map((item) => item.name)).toEqual(["Equity", "Gold"]);
    expect(analytics.allocations.brokerAllocation.map((item) => item.name)).toEqual(["Zerodha Kite", "PhonePe"]);
    expect(analytics.allocations.portfolioComposition.map((item) => item.name)).toEqual(["ETF", "Gold"]);
    expect(analytics.allocations.topHoldings).toHaveLength(2);
  });

  it("creates chart series without mutating the dashboard source", () => {
    const dashboard = populatedDashboard();
    const originalHoldings = structuredClone(dashboard.holdings);
    const analytics = buildAnalyticsDashboardData(dashboard, { asOf });
    const selected = selectAnalyticsTimeRange(analytics, "SINCE_INCEPTION");

    expect(selected.charts.portfolioGrowth.map((point) => point.portfolioValueMinor)).toEqual([
      100000,
      130000,
      90000,
      160000,
      175000
    ]);
    expect(selected.charts.monthlyReturns).toEqual([
      { date: "Feb", returnPercent: 30 },
      { date: "Mar", returnPercent: -30.8 },
      { date: "Apr", returnPercent: 77.8 },
      { date: "May", returnPercent: 9.4 }
    ]);
    expect(dashboard.holdings).toEqual(originalHoldings);
  });

  it("supports time range selection including the basic custom range", () => {
    const analytics = buildAnalyticsDashboardData(populatedDashboard(), { asOf });
    const oneMonth = selectAnalyticsTimeRange(analytics, "ONE_MONTH");
    const custom = selectAnalyticsTimeRange(analytics, "CUSTOM");
    const fallback = selectAnalyticsTimeRange(analytics, "NOT_A_RANGE" as never);

    expect(oneMonth.key).toBe("ONE_MONTH");
    expect(oneMonth.period.startDateIso).toBe("2026-05-30T00:00:00.000Z");
    expect(custom.key).toBe("CUSTOM");
    expect(custom.period.startDateIso).toBe("2026-01-01T00:00:00.000Z");
    expect(fallback.key).toBe("SINCE_INCEPTION");
  });
});

function populatedDashboard(): LedgerDashboardData {
  const holdings = [
    holding({
      id: "holding-equity",
      accountName: "Zerodha Kite",
      source: "Zerodha Kite",
      assetName: "Nippon India ETF Nifty BeES",
      symbol: "NIFTYBEES",
      assetClass: "Equity",
      assetType: "ETF",
      quantity: 10,
      costBasisMinor: 100000,
      currentValueMinor: 130000
    }),
    holding({
      id: "holding-gold",
      accountName: "PhonePe Gold",
      source: "PhonePe",
      assetName: "Digital Gold",
      symbol: "GOLD",
      assetClass: "Gold",
      assetType: "Gold",
      quantity: 5,
      costBasisMinor: 50000,
      currentValueMinor: 45000
    })
  ];
  const netWorth = calculateNetWorth(holdings, []);

  return {
    ...createZeroDashboardData(asOf),
    accounts: [
      { id: "account-zerodha", name: "Zerodha Kite", provider: "Zerodha Kite" },
      { id: "account-phonepe", name: "PhonePe Gold", provider: "PhonePe" }
    ],
    assets: [
      { id: "NIFTYBEES", name: "Nippon India ETF Nifty BeES", symbol: "NIFTYBEES", assetClass: "Equity", assetType: "ETF" },
      { id: "GOLD", name: "Digital Gold", symbol: "GOLD", assetClass: "Gold", assetType: "Gold" }
    ],
    transactions: [
      transaction("buy-equity", "BUY", 100000, "2026-01-01"),
      transaction("buy-gold", "BUY", 50000, "2026-02-01"),
      transaction("dividend-1", "DIVIDEND", 5000, "2026-05-01")
    ],
    holdings,
    netWorth,
    netWorthTrend: buildNetWorthTrend([
      { date: "Jan", assetsMinor: 100000, liabilitiesMinor: 0 },
      { date: "Feb", assetsMinor: 130000, liabilitiesMinor: 0 },
      { date: "Mar", assetsMinor: 90000, liabilitiesMinor: 0 },
      { date: "Apr", assetsMinor: 160000, liabilitiesMinor: 0 },
      { date: "May", assetsMinor: 175000, liabilitiesMinor: 0 }
    ])
  };
}

function holding(input: Pick<
  HoldingInput,
  | "id"
  | "accountName"
  | "source"
  | "assetName"
  | "symbol"
  | "assetClass"
  | "assetType"
  | "quantity"
  | "costBasisMinor"
  | "currentValueMinor"
>): HoldingInput {
  return {
    averageCostMinor: Math.round(input.costBasisMinor / input.quantity),
    currentPriceMinor: Math.round(input.currentValueMinor / input.quantity),
    currency: "INR",
    ...input
  };
}

function transaction(
  id: string,
  type: LedgerTransactionType,
  amountMinor: number,
  tradeDate: string
) {
  return {
    id,
    type,
    amountMinor,
    tradeDate: new Date(`${tradeDate}T00:00:00.000Z`)
  };
}

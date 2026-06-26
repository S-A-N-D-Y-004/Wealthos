import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PortfolioAnalyticsDashboard } from "@/components/dashboard/portfolio-analytics-dashboard";
import { buildAnalyticsDashboardData } from "@/lib/dashboard/analytics-dashboard";
import {
  createZeroDashboardData,
  type LedgerDashboardData
} from "@/lib/dashboard/ledger-dashboard";
import { buildNetWorthTrend, calculateNetWorth } from "@/lib/domain/calculations/net-worth";
import type { LedgerTransactionType } from "@/lib/domain/ledger";
import type { HoldingInput } from "@/lib/domain/models";

const asOf = new Date("2026-06-30T00:00:00.000Z");

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("portfolio analytics dashboard component", () => {
  it("renders an informative empty state", () => {
    const data = buildAnalyticsDashboardData(createZeroDashboardData(asOf), { asOf });
    const html = renderToStaticMarkup(<PortfolioAnalyticsDashboard data={data} />);

    expect(html).toContain("Portfolio analytics will appear after your first import");
    expect(html).toContain("Open Imports");
    expect(html).toContain("/imports");
  });

  it("renders populated overview, risk, chart, and allocation sections", () => {
    const data = buildAnalyticsDashboardData(populatedDashboard(), { asOf });
    const html = renderToStaticMarkup(<PortfolioAnalyticsDashboard data={data} />);

    expect(html).toContain("Current Portfolio Value");
    expect(html).toContain("Total Invested");
    expect(html).toContain("Money-Weighted Return");
    expect(html).toContain("Risk Rating");
    expect(html).toContain("Diversification Score");
    expect(html).toContain("Portfolio Growth");
    expect(html).toContain("Net Worth History");
    expect(html).toContain("Monthly Returns");
    expect(html).toContain("Asset Allocation");
    expect(html).toContain("Portfolio Allocation");
    expect(html).toContain("Broker Allocation");
    expect(html).toContain("Top Holdings");
    expect(html).toContain("Nippon India ETF Nifty BeES");
  });

  it("renders responsive grid classes and accessible time range tabs", () => {
    const data = buildAnalyticsDashboardData(populatedDashboard(), { asOf });
    const html = renderToStaticMarkup(<PortfolioAnalyticsDashboard data={data} />);

    expect(html).toContain("role=\"tablist\"");
    expect(html).toContain("aria-label=\"Analytics time range\"");
    expect(html).toContain("aria-selected=\"true\"");
    expect(html).toContain("md:grid-cols-2");
    expect(html).toContain("xl:grid-cols-4");
    expect(html).toContain("lg:grid-cols-3");
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
    transactions: [
      transaction("buy-equity", "BUY", 100000, "2026-01-01"),
      transaction("buy-gold", "BUY", 50000, "2026-02-01")
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

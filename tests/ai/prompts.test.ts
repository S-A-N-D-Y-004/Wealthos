import { describe, expect, it } from "vitest";
import { createZeroDashboardData, type LedgerDashboardData } from "@/lib/dashboard/ledger-dashboard";
import { calculateNetWorth } from "@/lib/domain/calculations/net-worth";
import type { AlertItem, HoldingInput } from "@/lib/domain/models";
import {
  AI_COACH_PROMPT_VERSION,
  buildFinancialCoachContext,
  buildFinancialCoachPrompt
} from "@/lib/ai";

const asOf = new Date("2026-06-16T00:00:00.000Z");

describe("financial coach prompt generation", () => {
  it("builds deterministic portfolio context with holdings, alerts, and price movements", () => {
    const dashboard = dashboardWith({
      holdings: [
        holding({
          id: "coindcx:btc",
          assetName: "Bitcoin",
          symbol: "BTC",
          assetClass: "Crypto",
          assetType: "Crypto",
          currentValueMinor: 300000
        }),
        holding({
          id: "zerodha:niftybees",
          assetName: "Nifty BeES",
          symbol: "NIFTYBEES",
          assetClass: "Equity",
          assetType: "ETF",
          currentValueMinor: 700000
        })
      ],
      alerts: [
        alert({
          id: "alert-price",
          title: "Nifty BeES moved +12.0%",
          message: "Nifty BeES changed +12.0% versus the previous price snapshot.",
          type: "Portfolio",
          severity: "Critical",
          metadata: {
            ruleId: "price-daily-change",
            assetId: "asset-niftybees",
            symbol: "NIFTYBEES",
            latestPriceMinor: 11200,
            previousPriceMinor: 10000,
            changePercent: 12,
            asOf: asOf.toISOString()
          }
        })
      ]
    });

    const first = buildFinancialCoachContext(dashboard, { asOf });
    const second = buildFinancialCoachContext(dashboard, { asOf });

    expect(first).toEqual(second);
    expect(first.portfolioState).toBe("active");
    expect(first.holdings.map((item) => item.symbol)).toEqual(["NIFTYBEES", "BTC"]);
    expect(first.allocation.map((item) => item.assetClass)).toEqual(["Equity", "Crypto"]);
    expect(first.priceMovements[0]).toMatchObject({
      assetId: "asset-niftybees",
      symbol: "NIFTYBEES",
      changePercent: 12
    });
  });

  it("includes advisory-only guardrails and the user question in prompts", () => {
    const prompt = buildFinancialCoachPrompt({
      dashboard: dashboardWith(),
      capability: "contextual-answer",
      userQuestion: "Why did my allocation risk increase?",
      asOf
    });

    expect(prompt.promptVersion).toBe(AI_COACH_PROMPT_VERSION);
    expect(prompt.userQuestion).toBe("Why did my allocation risk increase?");
    expect(prompt.instructions?.join(" ")).toContain("Do not recommend buying");
    expect(prompt.facts).toMatchObject({
      capability: "contextual-answer",
      outputContract: {
        style: "concise educational analysis"
      }
    });
  });

  it("handles empty portfolios as a deterministic zero-state context", () => {
    const context = buildFinancialCoachContext(createZeroDashboardData(asOf), { asOf });

    expect(context.portfolioState).toBe("empty");
    expect(context.netWorth).toEqual({
      totalAssetsMinor: 0,
      totalLiabilitiesMinor: 0,
      netWorthMinor: 0
    });
    expect(context.holdings).toEqual([]);
    expect(context.alerts).toEqual([]);
  });
});

function dashboardWith(input: {
  holdings?: HoldingInput[];
  alerts?: AlertItem[];
} = {}): LedgerDashboardData {
  const holdings = input.holdings ?? [];

  return {
    ...createZeroDashboardData(asOf),
    holdings,
    alerts: input.alerts ?? [],
    netWorth: calculateNetWorth(holdings, []),
    transactions: holdings.map((holding) => ({
      id: `txn:${holding.id}`,
      type: "BUY",
      amountMinor: holding.costBasisMinor,
      tradeDate: asOf
    }))
  };
}

function holding(input: Partial<HoldingInput> & Pick<HoldingInput, "id" | "assetName" | "assetClass" | "assetType" | "currentValueMinor">): HoldingInput {
  return {
    accountName: "Broker",
    source: "Manual",
    quantity: 1,
    averageCostMinor: input.currentValueMinor,
    currentPriceMinor: input.currentValueMinor,
    costBasisMinor: input.currentValueMinor,
    currency: "INR",
    ...input
  };
}

function alert(input: Partial<AlertItem> & Pick<AlertItem, "id" | "title" | "message">): AlertItem {
  return {
    type: "Portfolio",
    severity: "Warning",
    createdAt: asOf,
    ...input
  };
}

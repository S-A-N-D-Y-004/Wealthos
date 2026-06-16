import { describe, expect, it } from "vitest";
import { createZeroDashboardData, type LedgerDashboardData } from "@/lib/dashboard/ledger-dashboard";
import { calculateNetWorth } from "@/lib/domain/calculations/net-worth";
import { projectRetirement } from "@/lib/domain/calculations/retirement";
import { summarizeGoals } from "@/lib/domain/calculations/goals";
import type { GoalInput, HoldingInput } from "@/lib/domain/models";
import { evaluateAlertRules } from "@/lib/alerts";

const asOf = new Date("2026-06-16T00:00:00.000Z");

describe("alert rules", () => {
  it("creates deterministic price movement and threshold alerts", () => {
    const input = {
      userId: "user-1",
      dashboard: dashboard(),
      priceAssets: [
        {
          id: "asset-1",
          name: "Nifty BeES",
          symbol: "NIFTYBEES",
          currency: "INR",
          metadata: {
            priceAlertAboveMinor: 10500
          },
          priceSnapshots: [
            {
              priceMinor: 12000n,
              currency: "INR",
              asOf,
              fetchedAt: asOf
            },
            {
              priceMinor: 10000n,
              currency: "INR",
              asOf: new Date("2026-06-15T00:00:00.000Z"),
              fetchedAt: new Date("2026-06-15T00:00:00.000Z")
            }
          ]
        }
      ],
      asOf
    };

    const first = evaluateAlertRules(input);
    const second = evaluateAlertRules(input);

    expect(first.map((alert) => alert.id)).toEqual(second.map((alert) => alert.id));
    expect(first).toHaveLength(2);
    expect(first.map((alert) => alert.metadata.ruleId).sort()).toEqual([
      "price-daily-change",
      "price-threshold-above"
    ]);
    expect(first.every((alert) => alert.type === "PORTFOLIO")).toBe(true);
    expect(first.every((alert) => alert.severity === "CRITICAL")).toBe(true);
  });

  it("detects portfolio concentration and allocation drift from derived holdings", () => {
    const holdings = [
      holding({
        id: "zerodha:niftybees",
        assetName: "Nifty BeES",
        symbol: "NIFTYBEES",
        assetClass: "Equity",
        currentValueMinor: 800000
      }),
      holding({
        id: "phonepe:gold",
        assetName: "Digital Gold",
        symbol: "GOLD",
        assetClass: "Gold",
        currentValueMinor: 200000
      })
    ];
    const alerts = evaluateAlertRules({
      userId: "user-1",
      dashboard: dashboard({
        holdings,
        netWorth: calculateNetWorth(holdings, [])
      }),
      asOf,
      options: {
        allocationTargets: {
          Equity: 50,
          Gold: 50
        }
      }
    });

    expect(alerts.map((alert) => alert.metadata.ruleId).sort()).toEqual([
      "asset-allocation-drift",
      "asset-allocation-drift",
      "portfolio-concentration"
    ]);
    expect(alerts.find((alert) => alert.metadata.ruleId === "portfolio-concentration")).toMatchObject({
      severity: "CRITICAL",
      type: "PORTFOLIO"
    });
  });

  it("detects goals behind schedule and retirement funding gaps", () => {
    const goals = [
      goal({
        id: "goal-house",
        name: "House Down Payment",
        priority: "Critical",
        targetAmountMinor: 1_200_000,
        currentAmountMinor: 100_000,
        monthlyContributionMinor: 10_000,
        targetDate: new Date("2026-12-16T00:00:00.000Z")
      })
    ];
    const alerts = evaluateAlertRules({
      userId: "user-1",
      dashboard: dashboard({
        goals,
        goalSummary: summarizeGoals(goals, asOf),
        retirementProjection: projectRetirement({
          currentAge: 40,
          retirementAge: 60,
          currentCorpusMinor: 1_000_000,
          monthlyContributionMinor: 10_000,
          monthlyExpenseMinor: 100_000,
          inflationRate: 0.06,
          expectedAnnualReturnRate: 0.04,
          safeWithdrawalRate: 0.04
        })
      }),
      asOf
    });

    expect(alerts.map((alert) => alert.metadata.ruleId).sort()).toEqual([
      "goal-behind-schedule",
      "retirement-funding-gap"
    ]);
    expect(alerts.find((alert) => alert.type === "GOAL")).toMatchObject({
      severity: "CRITICAL",
      title: "House Down Payment is behind schedule"
    });
    expect(alerts.find((alert) => alert.type === "RETIREMENT")?.message).toContain("current assumptions");
  });

  it("detects stale prices and import failures", () => {
    const alerts = evaluateAlertRules({
      userId: "user-1",
      dashboard: dashboard(),
      priceAssets: [
        {
          id: "asset-stale",
          name: "Bitcoin",
          symbol: "BTC",
          currency: "INR",
          priceSnapshots: [
            {
              priceMinor: 5_000_000n,
              currency: "INR",
              asOf: new Date("2026-06-10T00:00:00.000Z"),
              fetchedAt: new Date("2026-06-10T00:00:00.000Z")
            }
          ]
        }
      ],
      failedImports: [
        {
          id: "import-1",
          source: "COINDCX",
          status: "FAILED",
          originalFileName: "coindcx.csv",
          validationSummary: { rejectedRows: 1 },
          createdAt: new Date("2026-06-15T00:00:00.000Z"),
          updatedAt: new Date("2026-06-15T01:00:00.000Z")
        },
        {
          id: "import-2",
          source: "ZERODHA_KITE",
          status: "COMPLETED",
          originalFileName: "kite.csv",
          createdAt: new Date("2026-06-15T00:00:00.000Z"),
          updatedAt: new Date("2026-06-15T01:00:00.000Z")
        }
      ],
      asOf
    });

    expect(alerts.map((alert) => alert.metadata.ruleId).sort()).toEqual(["import-failure", "stale-price"]);
    expect(alerts.find((alert) => alert.metadata.ruleId === "stale-price")).toMatchObject({
      severity: "WARNING",
      type: "SYSTEM"
    });
  });

  it("handles empty portfolios and missing price data gracefully", () => {
    const alerts = evaluateAlertRules({
      userId: "user-1",
      dashboard: dashboard(),
      priceAssets: [
        {
          id: "asset-empty",
          name: "Manual Asset",
          currency: "INR",
          metadata: null,
          priceSnapshots: []
        }
      ],
      asOf
    });

    expect(alerts).toEqual([]);
  });
});

function dashboard(overrides: Partial<LedgerDashboardData> = {}): LedgerDashboardData {
  return {
    ...createZeroDashboardData(asOf),
    ...overrides
  };
}

function holding(input: Partial<HoldingInput> & Pick<HoldingInput, "id" | "assetName" | "assetClass" | "currentValueMinor">): HoldingInput {
  return {
    accountName: "Broker",
    source: "Manual",
    assetType: "ETF",
    quantity: 1,
    averageCostMinor: input.currentValueMinor,
    currentPriceMinor: input.currentValueMinor,
    costBasisMinor: input.currentValueMinor,
    currency: "INR",
    ...input
  };
}

function goal(input: Partial<GoalInput> & Pick<GoalInput, "id" | "name">): GoalInput {
  return {
    type: "Custom",
    targetAmountMinor: 100_000,
    currentAmountMinor: 0,
    monthlyContributionMinor: 0,
    targetDate: new Date("2026-12-31T00:00:00.000Z"),
    priority: "Medium",
    currency: "INR",
    ...input
  };
}

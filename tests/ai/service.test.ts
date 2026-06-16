import { describe, expect, it } from "vitest";
import {
  createDeterministicFinancialCoachProvider,
  generateAndPersistPeriodicInsights,
  generateFinancialCoachInsight,
  generatePeriodicFinancialInsights,
  type AIInsightPrismaClient,
  type GeneratedFinancialInsight
} from "@/lib/ai";
import { createZeroDashboardData } from "@/lib/dashboard/ledger-dashboard";
import { generateAIInsightsJob } from "@/trigger/jobs/ai-insights";

const asOf = new Date("2026-06-16T00:00:00.000Z");

describe("financial coach insight generation", () => {
  it("generates deterministic periodic insights without external APIs", async () => {
    const dashboard = createZeroDashboardData(asOf);
    const provider = createDeterministicFinancialCoachProvider();

    const first = await generatePeriodicFinancialInsights({
      dashboard,
      provider,
      asOf
    });
    const second = await generatePeriodicFinancialInsights({
      dashboard,
      provider,
      asOf
    });

    expect(first.map((insight) => insight.id)).toEqual(second.map((insight) => insight.id));
    expect(first.map((insight) => insight.type).sort()).toEqual([
      "DIVERSIFICATION",
      "GOAL",
      "INVESTMENT_DISCIPLINE",
      "RISK_CONCENTRATION"
    ]);
    expect(first.every((insight) => insight.body.includes("not enough ledger history"))).toBe(true);
  });

  it("blocks unsafe provider output before persistence", async () => {
    await expect(
      generateFinancialCoachInsight({
        dashboard: createZeroDashboardData(asOf),
        capability: "contextual-answer",
        provider: {
          name: "openai",
          async generateInsight() {
            return "You should buy NIFTYBEES today.";
          }
        },
        asOf
      })
    ).rejects.toThrow("AI insight violates WealthOS educational-only policy.");
  });

  it("persists generated insights idempotently", async () => {
    const client = new FakeAIInsightClient();

    const first = await generateAndPersistPeriodicInsights({
      userId: "user-1",
      client,
      asOf
    });
    const second = await generateAndPersistPeriodicInsights({
      userId: "user-1",
      client,
      asOf
    });

    expect(first.persistedCount).toBe(4);
    expect(second.persistedCount).toBe(0);
    expect(client.insights).toHaveLength(4);
    expect(client.operations).toContain("aiInsight.createMany");
    expect(client.operations).not.toContain("holding.update");
    expect(client.operations).not.toContain("transaction.create");
  });

  it("wires the scheduled AI insight job to the coach service", async () => {
    const client = new FakeAIInsightClient();

    const result = await generateAIInsightsJob(
      {
        userId: "user-1",
        asOf,
        capabilities: ["wealth-score"]
      },
      client
    );

    expect(result.persistedCount).toBe(1);
    expect(client.insights[0]).toMatchObject({
      userId: "user-1",
      type: "NET_WORTH",
      title: "Portfolio Setup Context"
    });
  });
});

class FakeAIInsightClient implements AIInsightPrismaClient {
  operations: string[] = [];
  insights: Array<GeneratedFinancialInsight & { userId: string }> = [];

  account = {
    findMany: async () => []
  };

  liability = {
    findMany: async () => []
  };

  goal = {
    findMany: async () => []
  };

  retirementProfile = {
    findFirst: async () => null
  };

  netWorthSnapshot = {
    findMany: async () => []
  };

  activityLog = {
    findMany: async () => []
  };

  alert = {
    findMany: async () => []
  };

  aiInsight = {
    findMany: async () => [],
    createMany: async (args: unknown) => {
      this.operations.push("aiInsight.createMany");
      const rows = (args as { data: Array<GeneratedFinancialInsight & { userId: string }> }).data;
      let count = 0;

      for (const row of rows) {
        const duplicate = this.insights.some(
          (insight) =>
            insight.userId === row.userId
            && insight.type === row.type
            && insight.inputDigest === row.inputDigest
            && insight.promptVersion === row.promptVersion
        );

        if (!duplicate) {
          this.insights.push(row);
          count += 1;
        }
      }

      return { count };
    }
  };
}

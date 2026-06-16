import { NextResponse } from "next/server";
import { AIInsightService, createUnavailableProvider } from "@/lib/ai/providers";
import { getCurrentUserDashboardData } from "@/lib/dashboard/ledger-dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const dashboard = await getCurrentUserDashboardData();
  const service = new AIInsightService(createUnavailableProvider("openai"));
  const insight = await service.generate({
    type: "net-worth",
    facts: {
      netWorth: dashboard.netWorth,
      assetAllocation: dashboard.netWorth.assetAllocation,
      holdings: dashboard.netWorth.holdings,
      liabilities: dashboard.liabilities,
      goals: dashboard.goalSummary,
      retirementProjection: dashboard.retirementProjection,
      wealthScore: dashboard.wealthScore
    }
  });

  return NextResponse.json({
    provider: "openai",
    status: "provider-not-configured",
    insight
  });
}

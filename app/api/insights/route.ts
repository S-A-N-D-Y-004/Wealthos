import { NextResponse } from "next/server";
import { AIInsightService, createUnavailableProvider } from "@/lib/ai/providers";
import { netWorth, retirementProjection, wealthScore } from "@/lib/data/mock-wealth";

export async function GET() {
  const service = new AIInsightService(createUnavailableProvider("openai"));
  const insight = await service.generate({
    type: "net-worth",
    facts: {
      netWorth,
      retirementProjection,
      wealthScore
    }
  });

  return NextResponse.json({
    provider: "openai",
    status: "provider-not-configured",
    insight
  });
}


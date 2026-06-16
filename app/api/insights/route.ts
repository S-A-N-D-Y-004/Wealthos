import { NextResponse } from "next/server";
import {
  createDeterministicFinancialCoachProvider,
  generateAndPersistCoachResponse,
  generateAndPersistPeriodicInsights,
  getCurrentUserFinancialCoachZeroState,
  type AIInsightPrismaClient,
  type FinancialCoachCapability
} from "@/lib/ai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({
      provider: "deterministic",
      status: "zero-state",
      persistedCount: 0,
      insights: await getCurrentUserFinancialCoachZeroState()
    });
  }

  const result = await generateAndPersistPeriodicInsights({
    userId: session.user.id,
    client: prisma as unknown as AIInsightPrismaClient,
    provider: createDeterministicFinancialCoachProvider()
  });

  return NextResponse.json({
    provider: result.provider,
    status: "generated",
    generatedAt: result.generatedAt,
    persistedCount: result.persistedCount,
    insights: result.insights
  });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const capability = isFinancialCoachCapability(body.capability) ? body.capability : "contextual-answer";
  const userQuestion = typeof body.question === "string" ? body.question : undefined;
  const result = await generateAndPersistCoachResponse({
    userId: session.user.id,
    client: prisma as unknown as AIInsightPrismaClient,
    capability,
    userQuestion,
    provider: createDeterministicFinancialCoachProvider()
  });

  return NextResponse.json({
    provider: result.provider,
    status: "generated",
    generatedAt: result.generatedAt,
    persistedCount: result.persistedCount,
    insight: result.insight
  });
}

function isFinancialCoachCapability(value: unknown): value is FinancialCoachCapability {
  return typeof value === "string" && [
    "wealth-score",
    "goal-progress",
    "retirement-readiness",
    "alerts",
    "allocation-risk",
    "diversification-analysis",
    "concentration-analysis",
    "savings-analysis",
    "goal-tracking",
    "contextual-answer"
  ].includes(value);
}

import { z } from "zod";
import { apiServerError, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api/responses";
import { readJsonBody, validateJson } from "@/lib/api/request";
import {
  createDeterministicFinancialCoachProvider,
  generateAndPersistCoachResponse,
  generateAndPersistPeriodicInsights,
  type AIInsightPrismaClient,
  type FinancialCoachCapability
} from "@/lib/ai";
import { auth } from "@/lib/auth";
import type { DashboardPrismaClient } from "@/lib/dashboard/ledger-dashboard";
import { getDashboardProjection } from "@/lib/dashboard/projections";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const financialCoachCapabilitySchema = z.enum([
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
]);

const insightPostRequestSchema = z.object({
  mode: z.enum(["coach", "periodic"]).optional().default("coach"),
  capability: financialCoachCapabilitySchema.optional(),
  question: z.string().trim().min(1).max(2_000).optional()
}).strict();

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiUnauthorized();
    }

    const dashboard = await getDashboardProjection({
      userId: session.user.id,
      client: prisma as unknown as DashboardPrismaClient
    });

    return apiSuccess({
      status: "ready",
      insights: dashboard.insights
    });
  } catch {
    return apiServerError();
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiUnauthorized();
    }

    const body = await readJsonBody(request, {
      allowEmpty: true
    });

    if (!body.ok) {
      return apiValidationError(body.message, body.details);
    }

    const parsed = validateJson(
      insightPostRequestSchema,
      body.data,
      "Insight request failed validation."
    );

    if (!parsed.ok) {
      return apiValidationError(parsed.message, parsed.details);
    }

    if (parsed.data.mode === "periodic") {
      const result = await generateAndPersistPeriodicInsights({
        userId: session.user.id,
        client: prisma as unknown as AIInsightPrismaClient,
        provider: createDeterministicFinancialCoachProvider()
      });

      return apiSuccess({
        provider: result.provider,
        status: "generated",
        generatedAt: result.generatedAt,
        persistedCount: result.persistedCount,
        insights: result.insights
      });
    }

    const result = await generateAndPersistCoachResponse({
      userId: session.user.id,
      client: prisma as unknown as AIInsightPrismaClient,
      capability: toFinancialCoachCapability(parsed.data.capability),
      userQuestion: parsed.data.question,
      provider: createDeterministicFinancialCoachProvider()
    });

    return apiSuccess({
      provider: result.provider,
      status: "generated",
      generatedAt: result.generatedAt,
      persistedCount: result.persistedCount,
      insight: result.insight
    });
  } catch {
    return apiServerError();
  }
}

function toFinancialCoachCapability(value: z.infer<typeof financialCoachCapabilitySchema> | undefined): FinancialCoachCapability {
  return value ?? "contextual-answer";
}

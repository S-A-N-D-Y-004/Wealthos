import { prisma } from "@/lib/db";
import {
  createDeterministicFinancialCoachProvider,
  generateAndPersistPeriodicInsights,
  type AIInsightPrismaClient,
  type FinancialCoachCapability,
  type FinancialCoachGenerationResult
} from "@/lib/ai";

export type AIInsightGenerationJobInput = {
  userId: string;
  asOf?: Date;
  capabilities?: FinancialCoachCapability[];
};

export type AIInsightGenerationAllUsersJobInput = {
  asOf?: Date;
  capabilities?: FinancialCoachCapability[];
};

export type AIInsightGenerationJobClient = AIInsightPrismaClient & {
  user: {
    findMany(args: unknown): Promise<Array<{ id: string }>>;
  };
};

export async function generateAIInsightsJob(
  input: AIInsightGenerationJobInput,
  client: AIInsightPrismaClient = prisma as unknown as AIInsightPrismaClient
) {
  return generateAndPersistPeriodicInsights({
    userId: input.userId,
    client,
    provider: createDeterministicFinancialCoachProvider(),
    asOf: input.asOf,
    capabilities: input.capabilities
  });
}

export async function generateAllUserAIInsightsJob(
  input: AIInsightGenerationAllUsersJobInput = {},
  client: AIInsightGenerationJobClient = prisma as unknown as AIInsightGenerationJobClient
) {
  const users = await client.user.findMany({
    where: {
      deletedAt: null
    },
    select: {
      id: true
    },
    orderBy: {
      id: "asc"
    }
  });
  const results: FinancialCoachGenerationResult[] = [];

  for (const user of users) {
    results.push(
      await generateAndPersistPeriodicInsights({
        userId: user.id,
        client,
        provider: createDeterministicFinancialCoachProvider(),
        asOf: input.asOf,
        capabilities: input.capabilities
      })
    );
  }

  return {
    generatedAt: input.asOf ?? new Date(),
    usersEvaluated: users.length,
    generatedCount: results.reduce((sum, result) => sum + result.insights.length, 0),
    persistedCount: results.reduce((sum, result) => sum + result.persistedCount, 0),
    results
  };
}

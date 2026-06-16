import { prisma } from "@/lib/db";
import {
  evaluateAndPersistAlerts,
  type AlertEnginePrismaClient,
  type AlertEvaluationResult
} from "@/lib/alerts";

export type AlertEvaluationJobInput = {
  userId: string;
  asOf?: Date;
};

export type AlertEvaluationAllUsersJobInput = {
  asOf?: Date;
};

export type AlertEvaluationJobClient = AlertEnginePrismaClient & {
  user: {
    findMany(args: unknown): Promise<Array<{ id: string }>>;
  };
};

export async function evaluateAlertsJob(
  input: AlertEvaluationJobInput,
  client: AlertEnginePrismaClient = prisma as unknown as AlertEnginePrismaClient
) {
  return evaluateAndPersistAlerts({
    userId: input.userId,
    client,
    asOf: input.asOf
  });
}

export async function evaluateAllUserAlertsJob(
  input: AlertEvaluationAllUsersJobInput = {},
  client: AlertEvaluationJobClient = prisma as unknown as AlertEvaluationJobClient
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
  const results: AlertEvaluationResult[] = [];

  for (const user of users) {
    results.push(
      await evaluateAndPersistAlerts({
        userId: user.id,
        client,
        asOf: input.asOf
      })
    );
  }

  return {
    evaluatedAt: input.asOf ?? new Date(),
    usersEvaluated: users.length,
    generatedCount: results.reduce((sum, result) => sum + result.generated.length, 0),
    persistedCount: results.reduce((sum, result) => sum + result.persistedCount, 0),
    results
  };
}

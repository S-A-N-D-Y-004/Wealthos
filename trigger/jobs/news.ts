import { prisma } from "@/lib/db";
import {
  defaultNewsProviders,
  refreshNewsForUser,
  type NewsPrismaClient,
  type NewsProvider
} from "@/lib/news";

export type NewsRefreshJobInput = {
  userId: string;
  asOf?: Date;
  cacheTtlMs?: number;
  rateLimitMs?: number;
};

export type NewsRefreshAllUsersJobInput = {
  asOf?: Date;
  cacheTtlMs?: number;
  rateLimitMs?: number;
};

export type NewsRefreshJobClient = NewsPrismaClient & {
  user: {
    findMany(args: unknown): Promise<Array<{ id: string }>>;
  };
};

export async function refreshNewsJob(
  input: NewsRefreshJobInput,
  client: NewsPrismaClient = prisma as unknown as NewsPrismaClient,
  providers: NewsProvider[] = defaultNewsProviders()
) {
  return refreshNewsForUser({
    userId: input.userId,
    client,
    providers,
    asOf: input.asOf,
    cacheTtlMs: input.cacheTtlMs,
    rateLimitMs: input.rateLimitMs
  });
}

export async function refreshAllUserNewsJob(
  input: NewsRefreshAllUsersJobInput = {},
  client: NewsRefreshJobClient = prisma as unknown as NewsRefreshJobClient,
  providers: NewsProvider[] = defaultNewsProviders()
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
  const results = [];

  for (const user of users) {
    results.push(
      await refreshNewsForUser({
        userId: user.id,
        client,
        providers,
        asOf: input.asOf,
        cacheTtlMs: input.cacheTtlMs,
        rateLimitMs: input.rateLimitMs
      })
    );
  }

  return {
    refreshedAt: input.asOf ?? new Date(),
    usersEvaluated: users.length,
    articlesPersisted: results.reduce((sum, result) => sum + result.articlesPersisted, 0),
    alertsPersisted: results.reduce((sum, result) => sum + result.alertsPersisted, 0),
    results
  };
}

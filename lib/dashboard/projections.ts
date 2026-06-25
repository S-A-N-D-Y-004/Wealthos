import {
  buildLedgerDashboardData,
  type DashboardPrismaClient,
  type LedgerDashboardData
} from "@/lib/dashboard/ledger-dashboard";

export type DashboardProjectionInvalidationReason =
  | "csv-import"
  | "ledger-transaction-change"
  | "price-update"
  | "alert-update"
  | "ai-insight-update"
  | "news-update"
  | "manual";

export type DashboardProjectionBuilder = (input: {
  userId: string;
  client: DashboardPrismaClient;
  asOf: Date;
}) => Promise<LedgerDashboardData>;

export type DashboardProjectionCacheStats = {
  entries: number;
  globalVersion: number;
  userVersions: Record<string, number>;
};

type DashboardProjectionEntry = {
  userId: string;
  asOfKey: string;
  version: string;
  rebuiltAt: Date;
  data: LedgerDashboardData;
};

const projectionCache = new Map<string, DashboardProjectionEntry>();
const userVersions = new Map<string, number>();
let globalVersion = 0;

export async function getDashboardProjection({
  userId,
  client,
  asOf = new Date(),
  builder = buildLedgerDashboardData
}: {
  userId: string;
  client: DashboardPrismaClient;
  asOf?: Date;
  builder?: DashboardProjectionBuilder;
}) {
  const key = projectionCacheKey(userId, asOf);
  const version = projectionVersion(userId);
  const cached = projectionCache.get(key);

  if (cached?.version === version) {
    return cached.data;
  }

  return rebuildDashboardProjection({
    userId,
    client,
    asOf,
    builder
  });
}

export async function rebuildDashboardProjection({
  userId,
  client,
  asOf = new Date(),
  builder = buildLedgerDashboardData
}: {
  userId: string;
  client: DashboardPrismaClient;
  asOf?: Date;
  builder?: DashboardProjectionBuilder;
}) {
  const data = await builder({
    userId,
    client,
    asOf
  });
  const key = projectionCacheKey(userId, asOf);

  projectionCache.set(key, {
    userId,
    asOfKey: projectionDateKey(asOf),
    version: projectionVersion(userId),
    rebuiltAt: new Date(),
    data
  });

  return data;
}

export function invalidateDashboardProjection(
  userId: string,
  _reason: DashboardProjectionInvalidationReason = "manual"
) {
  void _reason;
  userVersions.set(userId, (userVersions.get(userId) ?? 0) + 1);

  for (const [key, entry] of projectionCache.entries()) {
    if (entry.userId === userId) {
      projectionCache.delete(key);
    }
  }
}

export function invalidateAllDashboardProjections(
  _reason: DashboardProjectionInvalidationReason = "manual"
) {
  void _reason;
  globalVersion += 1;
  projectionCache.clear();
}

export function clearDashboardProjectionCache() {
  globalVersion = 0;
  projectionCache.clear();
  userVersions.clear();
}

export function getDashboardProjectionCacheStats(): DashboardProjectionCacheStats {
  return {
    entries: projectionCache.size,
    globalVersion,
    userVersions: Object.fromEntries([...userVersions.entries()].sort(([left], [right]) => left.localeCompare(right)))
  };
}

function projectionCacheKey(userId: string, asOf: Date) {
  return `${userId}:${projectionDateKey(asOf)}`;
}

function projectionVersion(userId: string) {
  return `${globalVersion}:${userVersions.get(userId) ?? 0}`;
}

function projectionDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createZeroDashboardData,
  type DashboardPrismaClient,
  type LedgerDashboardData
} from "@/lib/dashboard/ledger-dashboard";
import {
  clearDashboardProjectionCache,
  getDashboardProjection,
  getDashboardProjectionCacheStats,
  invalidateAllDashboardProjections,
  invalidateDashboardProjection,
  rebuildDashboardProjection,
  type DashboardProjectionBuilder
} from "@/lib/dashboard/projections";

const asOf = new Date("2026-06-25T10:30:00.000Z");

describe("dashboard projection cache", () => {
  beforeEach(() => {
    clearDashboardProjectionCache();
  });

  it("rebuilds projections explicitly and serves subsequent cache hits", async () => {
    const builder = countingBuilder();
    const client = emptyDashboardClient();

    const first = await rebuildDashboardProjection({
      userId: "user-1",
      client,
      asOf,
      builder
    });
    const second = await getDashboardProjection({
      userId: "user-1",
      client,
      asOf,
      builder
    });

    expect(builder.calls()).toBe(1);
    expect(second).toBe(first);
    expect(getDashboardProjectionCacheStats()).toMatchObject({
      entries: 1,
      globalVersion: 0
    });
  });

  it("uses cache hits without recomputing a user projection", async () => {
    const builder = countingBuilder();
    const client = emptyDashboardClient();

    const first = await getDashboardProjection({ userId: "user-1", client, asOf, builder });
    const second = await getDashboardProjection({ userId: "user-1", client, asOf, builder });

    expect(first).toBe(second);
    expect(builder.calls()).toBe(1);
  });

  it("invalidates only the affected user for ledger transaction changes", async () => {
    const builder = countingBuilder();
    const client = emptyDashboardClient();

    await getDashboardProjection({ userId: "user-1", client, asOf, builder });
    await getDashboardProjection({ userId: "user-2", client, asOf, builder });

    invalidateDashboardProjection("user-1", "ledger-transaction-change");

    await getDashboardProjection({ userId: "user-1", client, asOf, builder });
    await getDashboardProjection({ userId: "user-2", client, asOf, builder });

    expect(builder.calls()).toBe(3);
    expect(getDashboardProjectionCacheStats()).toMatchObject({
      entries: 2,
      userVersions: {
        "user-1": 1
      }
    });
  });

  it("invalidates all projections for price updates", async () => {
    const builder = countingBuilder();
    const client = emptyDashboardClient();

    await getDashboardProjection({ userId: "user-1", client, asOf, builder });
    await getDashboardProjection({ userId: "user-2", client, asOf, builder });

    invalidateAllDashboardProjections("price-update");

    await getDashboardProjection({ userId: "user-1", client, asOf, builder });
    await getDashboardProjection({ userId: "user-2", client, asOf, builder });

    expect(builder.calls()).toBe(4);
    expect(getDashboardProjectionCacheStats()).toMatchObject({
      entries: 2,
      globalVersion: 1
    });
  });

  it("caches empty portfolio projections", async () => {
    const client = emptyDashboardClient();

    const dashboard = await getDashboardProjection({
      userId: "user-empty",
      client,
      asOf
    });

    expect(dashboard.accounts).toEqual([]);
    expect(dashboard.holdings).toEqual([]);
    expect(dashboard.netWorth.netWorthMinor).toBe(0);
    expect(client.account.findMany).toHaveBeenCalledTimes(1);

    await getDashboardProjection({
      userId: "user-empty",
      client,
      asOf
    });

    expect(client.account.findMany).toHaveBeenCalledTimes(1);
  });

  it("avoids repeated full-ledger reads for large transaction sets", async () => {
    const client = dashboardClientWithTransactions(10_000);

    const first = await getDashboardProjection({
      userId: "user-large",
      client,
      asOf
    });
    const second = await getDashboardProjection({
      userId: "user-large",
      client,
      asOf
    });

    expect(second).toBe(first);
    expect(client.account.findMany).toHaveBeenCalledTimes(1);
    expect(first.transactions).toHaveLength(10_000);
    expect(first.holdings).toHaveLength(1);
    expect(first.holdings[0]).toMatchObject({
      quantity: 10_000,
      currentValueMinor: 1_000_000
    });
  });
});

function countingBuilder() {
  let calls = 0;
  const builder: DashboardProjectionBuilder & { calls(): number } = Object.assign(
    async ({ asOf: projectionAsOf }: Parameters<DashboardProjectionBuilder>[0]) => {
      calls += 1;
      return {
        ...createZeroDashboardData(projectionAsOf),
        accounts: [
          {
            id: `account-${calls}`,
            name: "Cached Account",
            provider: "Manual"
          }
        ]
      } satisfies LedgerDashboardData;
    },
    {
      calls: () => calls
    }
  );

  return builder;
}

function emptyDashboardClient() {
  return {
    account: {
      findMany: vi.fn(async () => [])
    },
    liability: {
      findMany: vi.fn(async () => [])
    },
    goal: {
      findMany: vi.fn(async () => [])
    },
    retirementProfile: {
      findFirst: vi.fn(async () => null)
    },
    netWorthSnapshot: {
      findMany: vi.fn(async () => [])
    },
    activityLog: {
      findMany: vi.fn(async () => [])
    },
    alert: {
      findMany: vi.fn(async () => [])
    },
    aiInsight: {
      findMany: vi.fn(async () => [])
    },
    newsArticle: {
      findMany: vi.fn(async () => [])
    }
  } as unknown as DashboardPrismaClient & {
    account: { findMany: ReturnType<typeof vi.fn> };
  };
}

function dashboardClientWithTransactions(count: number) {
  const asset = {
    id: "asset-large",
    name: "Large Ledger ETF",
    symbol: "LARGE",
    type: "ETF",
    category: {
      kind: "EQUITY"
    },
    priceSnapshots: []
  };
  const transactions = Array.from({ length: count }, (_, index) => ({
    id: `txn-${index}`,
    accountId: "account-large",
    assetId: asset.id,
    type: "BUY",
    tradeDate: new Date("2026-06-01T00:00:00.000Z"),
    quantity: "1",
    priceMinor: 100n,
    amountMinor: 100n,
    feesMinor: 0n,
    taxesMinor: 0n,
    currency: "INR",
    asset
  }));
  const client = emptyDashboardClient();

  client.account.findMany = vi.fn(async () => [
    {
      id: "account-large",
      name: "Large Broker",
      provider: "MANUAL",
      transactions
    }
  ]);

  return client;
}

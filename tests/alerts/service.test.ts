import { describe, expect, it } from "vitest";
import {
  evaluateAndPersistAlerts,
  getNotificationAggregation,
  markAlertsRead,
  markAlertsUnread,
  type AlertEnginePrismaClient,
  type ImportFailureAlertSource,
  type PersistedAlertRow,
  type PriceAlertAsset
} from "@/lib/alerts";
import { evaluateAlertsJob } from "@/trigger/jobs/alerts";

const asOf = new Date("2026-06-16T00:00:00.000Z");

describe("alert service", () => {
  it("persists generated alerts idempotently", async () => {
    const client = new FakeAlertClient({
      assets: [
        {
          id: "asset-1",
          name: "Bitcoin",
          symbol: "BTC",
          currency: "INR",
          priceSnapshots: [
            {
              priceMinor: 5_500_000n,
              currency: "INR",
              asOf,
              fetchedAt: asOf
            },
            {
              priceMinor: 5_000_000n,
              currency: "INR",
              asOf: new Date("2026-06-15T00:00:00.000Z"),
              fetchedAt: new Date("2026-06-15T00:00:00.000Z")
            }
          ]
        }
      ],
      importJobs: [
        {
          id: "import-1",
          source: "COINDCX",
          status: "FAILED",
          originalFileName: "coindcx.csv",
          createdAt: asOf,
          updatedAt: asOf
        }
      ]
    });

    const first = await evaluateAndPersistAlerts({
      userId: "user-1",
      client,
      asOf
    });
    const second = await evaluateAndPersistAlerts({
      userId: "user-1",
      client,
      asOf
    });

    expect(first.generated.map((alert) => alert.metadata.ruleId).sort()).toEqual([
      "import-failure",
      "price-daily-change"
    ]);
    expect(first.persistedCount).toBe(2);
    expect(second.persistedCount).toBe(0);
    expect(client.alerts).toHaveLength(2);
    expect(new Set(client.alerts.map((alert) => alert.id)).size).toBe(2);
    expect(client.operations).not.toContain("holding.update");
    expect(client.operations).not.toContain("transaction.create");
  });

  it("aggregates notification counts and supports read/unread updates", async () => {
    const client = new FakeAlertClient({
      alerts: [
        persistedAlert({
          id: "alert-1",
          userId: "user-1",
          type: "PORTFOLIO",
          severity: "WARNING",
          readAt: null
        }),
        persistedAlert({
          id: "alert-2",
          userId: "user-1",
          type: "GOAL",
          severity: "CRITICAL",
          readAt: null
        }),
        persistedAlert({
          id: "alert-3",
          userId: "user-1",
          type: "SYSTEM",
          severity: "INFO",
          readAt: new Date("2026-06-15T00:00:00.000Z")
        }),
        persistedAlert({
          id: "alert-other-user",
          userId: "user-2",
          type: "SYSTEM",
          severity: "CRITICAL",
          readAt: null
        })
      ]
    });

    const initial = await getNotificationAggregation({
      userId: "user-1",
      client,
      limit: 10
    });

    expect(initial.totalCount).toBe(3);
    expect(initial.unreadCount).toBe(2);
    expect(initial.bySeverity).toEqual({
      info: 1,
      warning: 1,
      critical: 1
    });
    expect(initial.byType).toMatchObject({
      goal: 1,
      portfolio: 1,
      system: 1
    });

    const readResult = await markAlertsRead({
      userId: "user-1",
      client,
      alertIds: ["alert-1"],
      readAt: asOf
    });
    expect(readResult.count).toBe(1);
    expect((await getNotificationAggregation({ userId: "user-1", client })).unreadCount).toBe(1);

    const unreadResult = await markAlertsUnread({
      userId: "user-1",
      client,
      alertIds: ["alert-1"]
    });
    expect(unreadResult.count).toBe(1);
    expect((await getNotificationAggregation({ userId: "user-1", client })).unreadCount).toBe(2);
  });

  it("wires the scheduled alert job to the alert service", async () => {
    const client = new FakeAlertClient({
      assets: [
        {
          id: "asset-stale",
          name: "Nifty BeES",
          symbol: "NIFTYBEES",
          currency: "INR",
          priceSnapshots: [
            {
              priceMinor: 10000n,
              currency: "INR",
              asOf: new Date("2026-06-10T00:00:00.000Z"),
              fetchedAt: new Date("2026-06-10T00:00:00.000Z")
            }
          ]
        }
      ]
    });

    const result = await evaluateAlertsJob(
      {
        userId: "user-1",
        asOf
      },
      client
    );

    expect(result.persistedCount).toBe(1);
    expect(client.alerts[0]).toMatchObject({
      userId: "user-1",
      type: "SYSTEM",
      severity: "WARNING"
    });
  });
});

class FakeAlertClient implements AlertEnginePrismaClient {
  operations: string[] = [];
  alerts: Array<PersistedAlertRow & { userId: string }> = [];

  constructor(private readonly data: {
    assets?: PriceAlertAsset[];
    assetCategories?: Array<{ kind: string; targetAllocation: unknown | null }>;
    importJobs?: ImportFailureAlertSource[];
    alerts?: Array<PersistedAlertRow & { userId: string }>;
  } = {}) {
    this.alerts = [...(data.alerts ?? [])];
  }

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

  aiInsight = {
    findMany: async () => []
  };

  newsArticle = {
    findMany: async () => []
  };

  asset = {
    findMany: async () => this.data.assets ?? []
  };

  assetCategory = {
    findMany: async () => this.data.assetCategories ?? []
  };

  importJob = {
    findMany: async () => this.data.importJobs ?? []
  };

  alert = {
    findMany: async (args: unknown) => {
      this.operations.push("alert.findMany");
      const where = (args as { where?: Record<string, unknown>; take?: number }).where ?? {};
      const take = (args as { take?: number }).take;
      const rows = this.alerts
        .filter((alert) => matchesWhere(alert, where))
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

      return typeof take === "number" ? rows.slice(0, take) : rows;
    },
    createMany: async (args: unknown) => {
      this.operations.push("alert.createMany");
      const data = (args as { data: Array<Record<string, unknown>> }).data;
      let count = 0;

      for (const row of data) {
        if (this.alerts.some((alert) => alert.id === row.id)) {
          continue;
        }

        this.alerts.push({
          id: row.id as string,
          userId: row.userId as string,
          type: row.type as string,
          channel: row.channel as string,
          severity: row.severity as string,
          title: row.title as string,
          message: row.message as string,
          readAt: null,
          scheduledFor: (row.scheduledFor as Date | undefined) ?? null,
          metadata: row.metadata,
          createdAt: asOf
        });
        count += 1;
      }

      return { count };
    },
    updateMany: async (args: unknown) => {
      this.operations.push("alert.updateMany");
      const where = (args as { where: Record<string, unknown> }).where;
      const data = (args as { data: { readAt: Date | null } }).data;
      let count = 0;

      for (const alert of this.alerts) {
        if (matchesWhere(alert, where)) {
          alert.readAt = data.readAt;
          count += 1;
        }
      }

      return { count };
    },
    count: async (args: unknown) => {
      this.operations.push("alert.count");
      const where = (args as { where?: Record<string, unknown> }).where ?? {};
      return this.alerts.filter((alert) => matchesWhere(alert, where)).length;
    }
  };
}

function matchesWhere(row: PersistedAlertRow & { userId: string }, where: Record<string, unknown>) {
  if (where.userId && row.userId !== where.userId) {
    return false;
  }

  if (where.type && row.type !== where.type) {
    return false;
  }

  if (where.severity && row.severity !== where.severity) {
    return false;
  }

  if ("readAt" in where && row.readAt !== where.readAt) {
    return false;
  }

  if (where.id && typeof where.id === "object" && "in" in where.id) {
    const ids = (where.id as { in: string[] }).in;
    return ids.includes(row.id);
  }

  return true;
}

function persistedAlert(input: Partial<PersistedAlertRow> & {
  id: string;
  userId: string;
  type: string;
  severity: string;
  readAt: Date | null;
}): PersistedAlertRow & { userId: string } {
  return {
    channel: "IN_APP",
    title: "Alert",
    message: "Message",
    createdAt: asOf,
    metadata: {},
    ...input
  };
}

import {
  buildLedgerDashboardData,
  type DashboardPrismaClient
} from "@/lib/dashboard/ledger-dashboard";
import type { AlertItem, AssetClass } from "@/lib/domain/models";
import { evaluateAlertRules } from "@/lib/alerts/rules";
import type {
  AlertRuleOptions,
  AlertRuleSeverity,
  AlertRuleType,
  DerivedAlert,
  ImportFailureAlertSource,
  NotificationAggregation,
  NotificationAlert,
  PriceAlertAsset
} from "@/lib/alerts/types";

export type PersistedAlertRow = {
  id: string;
  type: string;
  channel?: string;
  severity: string;
  title: string;
  message: string;
  readAt: Date | null;
  scheduledFor?: Date | null;
  metadata?: unknown;
  createdAt: Date;
};

export type AlertEnginePrismaClient = Omit<DashboardPrismaClient, "alert"> & {
  alert: {
    findMany(args: unknown): Promise<PersistedAlertRow[]>;
    createMany(args: unknown): Promise<{ count: number }>;
    updateMany(args: unknown): Promise<{ count: number }>;
    count(args: unknown): Promise<number>;
  };
  asset: {
    findMany(args: unknown): Promise<PriceAlertAsset[]>;
  };
  assetCategory: {
    findMany(args: unknown): Promise<AllocationTargetRow[]>;
  };
  importJob: {
    findMany(args: unknown): Promise<ImportFailureAlertSource[]>;
  };
};

type AllocationTargetRow = {
  kind: string;
  targetAllocation: unknown | null;
};

export type AlertEvaluationResult = {
  evaluatedAt: Date;
  generated: DerivedAlert[];
  persistedCount: number;
};

export async function evaluateAndPersistAlerts({
  userId,
  client,
  asOf = new Date(),
  options
}: {
  userId: string;
  client: AlertEnginePrismaClient;
  asOf?: Date;
  options?: Partial<AlertRuleOptions>;
}): Promise<AlertEvaluationResult> {
  const [dashboard, priceAssets, allocationTargets, failedImports] = await Promise.all([
    buildLedgerDashboardData({
      userId,
      client: client as unknown as DashboardPrismaClient,
      asOf
    }),
    loadPriceAlertAssets(client, userId),
    loadAllocationTargets(client),
    loadFailedImports(client, userId)
  ]);
  const generated = evaluateAlertRules({
    userId,
    dashboard,
    priceAssets,
    failedImports,
    asOf,
    options: {
      ...options,
      allocationTargets: {
        ...allocationTargets,
        ...options?.allocationTargets
      }
    }
  });
  const persistedCount =
    generated.length === 0
      ? 0
      : (await client.alert.createMany({
          data: generated.map(alertToCreateInput),
          skipDuplicates: true
        })).count;

  return {
    evaluatedAt: asOf,
    generated,
    persistedCount
  };
}

export async function getCurrentUserNotificationAggregation() {
  const [{ auth }, { prisma }] = await Promise.all([import("@/lib/auth"), import("@/lib/db")]);
  const session = await auth();

  if (!session?.user?.id) {
    return zeroNotificationAggregation();
  }

  return getNotificationAggregation({
    userId: session.user.id,
    client: prisma as unknown as AlertEnginePrismaClient
  });
}

export async function evaluateCurrentUserAlerts({
  asOf = new Date(),
  options
}: {
  asOf?: Date;
  options?: Partial<AlertRuleOptions>;
} = {}) {
  const [{ auth }, { prisma }] = await Promise.all([import("@/lib/auth"), import("@/lib/db")]);
  const session = await auth();

  if (!session?.user?.id) {
    return {
      evaluatedAt: asOf,
      generated: [],
      persistedCount: 0
    };
  }

  return evaluateAndPersistAlerts({
    userId: session.user.id,
    client: prisma as unknown as AlertEnginePrismaClient,
    asOf,
    options
  });
}

export async function getNotificationAggregation({
  userId,
  client,
  limit = 20
}: {
  userId: string;
  client: AlertEnginePrismaClient;
  limit?: number;
}): Promise<NotificationAggregation> {
  const [
    latest,
    totalCount,
    unreadCount,
    infoCount,
    warningCount,
    criticalCount,
    goalCount,
    retirementCount,
    portfolioCount,
    importCount,
    systemCount
  ] = await Promise.all([
    client.alert.findMany({
      where: {
        userId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: limit
    }),
    client.alert.count({
      where: {
        userId
      }
    }),
    client.alert.count({
      where: {
        userId,
        readAt: null
      }
    }),
    countBySeverity(client, userId, "INFO"),
    countBySeverity(client, userId, "WARNING"),
    countBySeverity(client, userId, "CRITICAL"),
    countByType(client, userId, "GOAL"),
    countByType(client, userId, "RETIREMENT"),
    countByType(client, userId, "PORTFOLIO"),
    countByType(client, userId, "IMPORT"),
    countByType(client, userId, "SYSTEM")
  ]);

  return {
    totalCount,
    unreadCount,
    latest: latest.map(mapPersistedAlert),
    bySeverity: {
      info: infoCount,
      warning: warningCount,
      critical: criticalCount
    },
    byType: {
      goal: goalCount,
      retirement: retirementCount,
      portfolio: portfolioCount,
      import: importCount,
      system: systemCount
    }
  };
}

export async function markAlertsRead({
  userId,
  client,
  alertIds,
  readAt = new Date()
}: {
  userId: string;
  client: AlertEnginePrismaClient;
  alertIds?: string[];
  readAt?: Date;
}) {
  return client.alert.updateMany({
    where: alertWhere(userId, alertIds),
    data: {
      readAt
    }
  });
}

export async function markAlertsUnread({
  userId,
  client,
  alertIds
}: {
  userId: string;
  client: AlertEnginePrismaClient;
  alertIds?: string[];
}) {
  return client.alert.updateMany({
    where: alertWhere(userId, alertIds),
    data: {
      readAt: null
    }
  });
}

export function zeroNotificationAggregation(): NotificationAggregation {
  return {
    totalCount: 0,
    unreadCount: 0,
    latest: [],
    bySeverity: {
      info: 0,
      warning: 0,
      critical: 0
    },
    byType: {
      goal: 0,
      retirement: 0,
      portfolio: 0,
      import: 0,
      system: 0
    }
  };
}

function alertToCreateInput(alert: DerivedAlert) {
  return {
    id: alert.id,
    userId: alert.userId,
    type: alert.type,
    channel: alert.channel,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    scheduledFor: alert.scheduledFor,
    metadata: alert.metadata
  };
}

async function loadPriceAlertAssets(client: AlertEnginePrismaClient, userId: string) {
  return client.asset.findMany({
    where: {
      deletedAt: null,
      transactions: {
        some: {
          userId,
          deletedAt: null
        }
      }
    },
    include: {
      priceSnapshots: {
        orderBy: {
          asOf: "desc"
        },
        take: 2
      }
    },
    orderBy: {
      name: "asc"
    }
  });
}

async function loadAllocationTargets(client: AlertEnginePrismaClient) {
  const rows = await client.assetCategory.findMany({
    where: {
      targetAllocation: {
        not: null
      }
    }
  });
  const targets: Partial<Record<AssetClass, number>> = {};

  for (const row of rows) {
    const assetClass = mapAssetClassKind(row.kind);
    const target = toOptionalNumber(row.targetAllocation);

    if (assetClass && target !== undefined) {
      targets[assetClass] = target;
    }
  }

  return targets;
}

async function loadFailedImports(client: AlertEnginePrismaClient, userId: string) {
  return client.importJob.findMany({
    where: {
      userId,
      status: "FAILED"
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 20
  });
}

function countBySeverity(client: AlertEnginePrismaClient, userId: string, severity: AlertRuleSeverity) {
  return client.alert.count({
    where: {
      userId,
      severity
    }
  });
}

function countByType(client: AlertEnginePrismaClient, userId: string, type: AlertRuleType) {
  return client.alert.count({
    where: {
      userId,
      type
    }
  });
}

function alertWhere(userId: string, alertIds?: string[]) {
  return alertIds && alertIds.length > 0
    ? {
        userId,
        id: {
          in: alertIds
        }
      }
    : {
        userId
      };
}

function mapPersistedAlert(alert: PersistedAlertRow): NotificationAlert {
  return {
    id: alert.id,
    type: titleCase(alert.type) as AlertItem["type"],
    severity: titleCase(alert.severity) as AlertItem["severity"],
    title: alert.title,
    message: alert.message,
    createdAt: alert.createdAt,
    readAt: alert.readAt ?? undefined,
    metadata: alert.metadata
  };
}

function mapAssetClassKind(value: string): AssetClass | undefined {
  const classes: Record<string, AssetClass> = {
    EQUITY: "Equity",
    DEBT: "Debt",
    CASH: "Cash",
    GOLD: "Gold",
    CRYPTO: "Crypto",
    REAL_ESTATE: "Real Estate",
    ALTERNATIVE: "Alternative",
    INSURANCE: "Alternative",
    OTHER: "Alternative"
  };

  return classes[value];
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }

  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

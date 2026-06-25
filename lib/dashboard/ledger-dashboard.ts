import { buildNetWorthTrend, calculateNetWorth } from "@/lib/domain/calculations/net-worth";
import { summarizeGoals } from "@/lib/domain/calculations/goals";
import { projectRetirement, type RetirementProjection } from "@/lib/domain/calculations/retirement";
import { calculateWealthScore } from "@/lib/domain/calculations/wealth-score";
import { deriveHoldingFromTransactions, type LedgerTransaction, type LedgerTransactionType } from "@/lib/domain/ledger";
import type {
  ActivityItem,
  AlertItem,
  AssetClass,
  AssetType,
  BrokerSource,
  GoalInput,
  HoldingInput,
  InsightItem,
  LiabilityInput,
  NewsItem
} from "@/lib/domain/models";

export type LedgerDashboardData = {
  accounts: Array<{ id: string; name: string; provider: BrokerSource }>;
  assets: Array<{ id: string; name: string; symbol?: string; assetClass: AssetClass; assetType: AssetType }>;
  transactions: Array<{ id: string; type: LedgerTransactionType; amountMinor: number; tradeDate: Date }>;
  holdings: HoldingInput[];
  liabilities: LiabilityInput[];
  goals: GoalInput[];
  netWorth: ReturnType<typeof calculateNetWorth>;
  netWorthTrend: ReturnType<typeof buildNetWorthTrend>;
  goalSummary: ReturnType<typeof summarizeGoals>;
  retirementProjection: RetirementProjection;
  wealthScore: ReturnType<typeof calculateWealthScore>;
  monthlyInvestmentProgress: {
    plannedMinor: number;
    actualMinor: number;
    progressPercent: number;
  };
  activities: ActivityItem[];
  alerts: AlertItem[];
  insights: InsightItem[];
  news: NewsItem[];
};

export type DashboardPrismaClient = {
  account: {
    findMany(args: unknown): Promise<AccountRow[]>;
  };
  liability: {
    findMany(args: unknown): Promise<LiabilityRow[]>;
  };
  goal: {
    findMany(args: unknown): Promise<GoalRow[]>;
  };
  retirementProfile: {
    findFirst(args: unknown): Promise<RetirementProfileRow | null>;
  };
  netWorthSnapshot: {
    findMany(args: unknown): Promise<NetWorthSnapshotRow[]>;
  };
  activityLog: {
    findMany(args: unknown): Promise<ActivityLogRow[]>;
  };
  alert: {
    findMany(args: unknown): Promise<AlertRow[]>;
  };
  aiInsight: {
    findMany(args: unknown): Promise<AIInsightRow[]>;
  };
  newsArticle: {
    findMany(args: unknown): Promise<NewsArticleRow[]>;
  };
};

type AccountRow = {
  id: string;
  name: string;
  provider: string;
  transactions: TransactionRow[];
};

type TransactionRow = {
  id: string;
  accountId: string;
  assetId: string | null;
  type: string;
  tradeDate: Date;
  quantity: unknown | null;
  priceMinor: bigint | number | null;
  amountMinor: bigint | number;
  feesMinor: bigint | number;
  taxesMinor: bigint | number;
  currency: string;
  asset: AssetRow | null;
};

type AssetRow = {
  id: string;
  name: string;
  symbol: string | null;
  type: string;
  category: {
    kind: string;
  };
  priceSnapshots?: PriceSnapshotRow[];
};

type PriceSnapshotRow = {
  priceMinor: bigint | number;
  currency: string;
  asOf: Date;
  fetchedAt: Date;
  isStale?: boolean;
};

type LiabilityRow = {
  id: string;
  name: string;
  type: string;
  outstandingMinor: bigint | number;
  emiMinor: bigint | number | null;
  interestRate: unknown | null;
  currency: string;
};

type GoalRow = {
  id: string;
  name: string;
  type: string;
  targetAmountMinor: bigint | number;
  currentAmountMinor: bigint | number;
  monthlyFundingMinor: bigint | number;
  targetDate: Date;
  priority: string;
};

type RetirementProfileRow = {
  currentAge: number;
  retirementAge: number;
  currentCorpusMinor: bigint | number;
  monthlyContributionMinor: bigint | number;
  monthlyExpenseMinor: bigint | number;
  inflationRate: unknown;
  expectedReturnRate: unknown;
  safeWithdrawalRate: unknown;
};

type NetWorthSnapshotRow = {
  snapshotDate: Date;
  totalAssetsMinor: bigint | number;
  totalLiabilitiesMinor: bigint | number;
};

type ActivityLogRow = {
  id: string;
  action: string;
  entityType: string;
  summary: string;
  createdAt: Date;
};

type AlertRow = {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  metadata?: unknown;
  createdAt: Date;
  readAt: Date | null;
};

type AIInsightRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  confidence: unknown | null;
  createdAt: Date;
};

type NewsArticleRow = {
  id: string;
  title: string;
  summary: string | null;
  url: string | null;
  sourceName: string | null;
  publishedAt: Date;
  sentiment: string;
  sentimentScore: unknown;
  assets?: Array<{
    symbol: string | null;
    asset?: {
      name: string;
      symbol: string | null;
    };
  }>;
};

export async function getCurrentUserDashboardData() {
  const [{ auth }, { prisma }, { getDashboardProjection }] = await Promise.all([
    import("@/lib/auth"),
    import("@/lib/db"),
    import("@/lib/dashboard/projections")
  ]);
  const session = await auth();

  if (!session?.user?.id) {
    return createZeroDashboardData();
  }

  return getDashboardProjection({
    userId: session.user.id,
    client: prisma as unknown as DashboardPrismaClient
  });
}

export async function buildLedgerDashboardData({
  userId,
  client,
  asOf = new Date()
}: {
  userId: string;
  client: DashboardPrismaClient;
  asOf?: Date;
}): Promise<LedgerDashboardData> {
  const [accounts, liabilities, goals, retirementProfile, snapshots, activities, alerts, insights, news] = await Promise.all([
    client.account.findMany({
      where: {
        userId,
        deletedAt: null,
        isActive: true
      },
      include: {
        transactions: {
          where: {
            deletedAt: null
          },
          orderBy: {
            tradeDate: "asc"
          },
          include: {
            asset: {
              include: {
                category: true,
                priceSnapshots: {
                  orderBy: {
                    asOf: "desc"
                  },
                  take: 1
                }
              }
            }
          }
        }
      },
      orderBy: {
        name: "asc"
      }
    }),
    client.liability.findMany({
      where: {
        userId,
        deletedAt: null
      },
      orderBy: {
        name: "asc"
      }
    }),
    client.goal.findMany({
      where: {
        userId,
        deletedAt: null
      },
      orderBy: {
        targetDate: "asc"
      }
    }),
    client.retirementProfile.findFirst({
      where: {
        userId,
        deletedAt: null
      },
      orderBy: {
        updatedAt: "desc"
      }
    }),
    client.netWorthSnapshot.findMany({
      where: {
        userId
      },
      orderBy: {
        snapshotDate: "asc"
      },
      take: 12
    }),
    client.activityLog.findMany({
      where: {
        userId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5
    }),
    client.alert.findMany({
      where: {
        userId,
        readAt: null
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    }),
    client.aiInsight.findMany({
      where: {
        userId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5
    }),
    client.newsArticle.findMany({
      where: {
        assets: {
          some: {
            asset: {
              transactions: {
                some: {
                  userId,
                  deletedAt: null
                }
              }
            }
          }
        }
      },
      include: {
        assets: {
          include: {
            asset: true
          }
        }
      },
      orderBy: {
        publishedAt: "desc"
      },
      take: 10
    })
  ]);
  const holdings = deriveHoldingInputsFromAccounts(accounts, asOf);
  const liabilityInputs = liabilities.map(mapLiability);
  const goalInputs = goals.map(mapGoal);
  const netWorth = calculateNetWorth(holdings, liabilityInputs);
  const goalSummary = summarizeGoals(goalInputs, asOf);
  const monthlyInvestmentProgress = calculateMonthlyInvestmentProgress(accounts, goalInputs, asOf);
  const wealthScore = calculateWealthScore({
    savingsRatePercent: monthlyInvestmentProgress.progressPercent,
    investmentConsistencyPercent: monthlyInvestmentProgress.actualMinor > 0 ? 100 : 0,
    diversificationPercent: calculateDiversificationScore(netWorth.assetAllocation.length),
    emergencyFundCoverageMonths: 0,
    goalProgressPercent: goalSummary.aggregateProgressPercent
  });

  return {
    accounts: accounts
      .map((account) => ({
        id: account.id,
        name: account.name,
        provider: mapProvider(account.provider)
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    assets: uniqueAssetsFromHoldings(holdings),
    transactions: accounts
      .flatMap((account) => account.transactions)
      .map((transaction) => ({
        id: transaction.id,
        type: transaction.type as LedgerTransactionType,
        amountMinor: toNumber(transaction.amountMinor),
        tradeDate: transaction.tradeDate
      })),
    holdings,
    liabilities: [...liabilityInputs].sort((left, right) => left.name.localeCompare(right.name)),
    goals: goalInputs,
    netWorth,
    netWorthTrend: buildDashboardTrend(snapshots, netWorth, asOf),
    goalSummary,
    retirementProjection: retirementProfile
      ? projectRetirement({
          currentAge: retirementProfile.currentAge,
          retirementAge: retirementProfile.retirementAge,
          currentCorpusMinor: toNumber(retirementProfile.currentCorpusMinor),
          monthlyContributionMinor: toNumber(retirementProfile.monthlyContributionMinor),
          monthlyExpenseMinor: toNumber(retirementProfile.monthlyExpenseMinor),
          inflationRate: toNumber(retirementProfile.inflationRate),
          expectedAnnualReturnRate: toNumber(retirementProfile.expectedReturnRate),
          safeWithdrawalRate: toNumber(retirementProfile.safeWithdrawalRate)
        })
      : zeroRetirementProjection(),
    wealthScore,
    monthlyInvestmentProgress,
    activities: activities.map((activity) => ({
      id: activity.id,
      action: titleCase(activity.action),
      entity: titleCase(activity.entityType),
      summary: activity.summary,
      occurredAt: activity.createdAt
    })),
    alerts: alerts.map((alert) => ({
      id: alert.id,
      type: titleCase(alert.type) as AlertItem["type"],
      severity: titleCase(alert.severity) as AlertItem["severity"],
      title: alert.title,
      message: alert.message,
      createdAt: alert.createdAt,
      readAt: alert.readAt ?? undefined,
      metadata: alert.metadata
    })),
    insights: insights.map((insight) => ({
      id: insight.id,
      type: mapInsightType(insight.type),
      title: insight.title,
      body: insight.body,
      confidence: insight.confidence === null ? 0 : toNumber(insight.confidence),
      createdAt: insight.createdAt
    })),
    news: news.map(mapNewsArticle)
  };
}

export function createZeroDashboardData(asOf = new Date()): LedgerDashboardData {
  const netWorth = calculateNetWorth([], []);
  const goalSummary = summarizeGoals([], asOf);

  return {
    accounts: [],
    assets: [],
    transactions: [],
    holdings: [],
    liabilities: [],
    goals: [],
    netWorth,
    netWorthTrend: [],
    goalSummary,
    retirementProjection: zeroRetirementProjection(),
    wealthScore: calculateWealthScore({
      savingsRatePercent: 0,
      investmentConsistencyPercent: 0,
      diversificationPercent: 0,
      emergencyFundCoverageMonths: 0,
      goalProgressPercent: 0
    }),
    monthlyInvestmentProgress: {
      plannedMinor: 0,
      actualMinor: 0,
      progressPercent: 0
    },
    activities: [],
    alerts: [],
    insights: [],
    news: []
  };
}

function mapNewsArticle(article: NewsArticleRow): NewsItem {
  const assets = article.assets ?? [];

  return {
    id: article.id,
    title: article.title,
    summary: article.summary ?? undefined,
    url: article.url ?? undefined,
    sourceName: article.sourceName ?? undefined,
    publishedAt: article.publishedAt,
    sentiment: titleCase(article.sentiment) as NewsItem["sentiment"],
    sentimentScore: toNumber(article.sentimentScore),
    symbols: uniqueStrings(assets.map((item) => item.symbol ?? item.asset?.symbol ?? undefined)),
    assetNames: uniqueStrings(assets.map((item) => item.asset?.name))
  };
}

function deriveHoldingInputsFromAccounts(accounts: AccountRow[], asOf: Date): HoldingInput[] {
  const holdings: HoldingInput[] = [];

  for (const account of accounts) {
    const assetTransactions = account.transactions.filter((transaction) => transaction.assetId && transaction.asset);
    const grouped = groupBy(assetTransactions, (transaction) => `${transaction.accountId}:${transaction.assetId}`);

    for (const transactions of grouped.values()) {
      const first = transactions[0];
      const asset = first.asset;

      if (!asset) {
        continue;
      }

      const ledgerTransactions = transactions.map(mapLedgerTransaction);
      const derived = deriveHoldingFromTransactions(ledgerTransactions);
      const latestPriceSnapshot = asset.priceSnapshots?.[0];
      const latestTradePriceMinor = latestDefined(ledgerTransactions.map((transaction) => transaction.priceMinor));
      const currentPriceMinor =
        latestPriceSnapshot && latestPriceSnapshot.currency === first.currency
          ? toNumber(latestPriceSnapshot.priceMinor)
          : latestTradePriceMinor ?? derived.averageCostMinor;
      const currentValueMinor = Math.round(derived.quantity * currentPriceMinor);

      holdings.push({
        id: `${account.id}:${asset.id}`,
        accountName: account.name,
        source: mapProvider(account.provider),
        assetName: asset.name,
        symbol: asset.symbol ?? undefined,
        assetClass: mapAssetClass(asset.category.kind),
        assetType: mapAssetType(asset.type),
        quantity: derived.quantity,
        averageCostMinor: derived.averageCostMinor,
        currentPriceMinor,
        costBasisMinor: derived.costBasisMinor,
        currentValueMinor,
        currency: first.currency
      });
    }
  }

  return holdings.sort((left, right) => right.currentValueMinor - left.currentValueMinor || left.assetName.localeCompare(right.assetName));
}

function mapLedgerTransaction(transaction: TransactionRow): LedgerTransaction {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    assetId: transaction.assetId ?? undefined,
    type: transaction.type as LedgerTransactionType,
    quantity: toOptionalNumber(transaction.quantity),
    priceMinor: toOptionalNumber(transaction.priceMinor),
    amountMinor: toNumber(transaction.amountMinor),
    feesMinor: toNumber(transaction.feesMinor),
    taxesMinor: toNumber(transaction.taxesMinor),
    currency: transaction.currency,
    occurredAt: transaction.tradeDate
  };
}

function mapLiability(liability: LiabilityRow): LiabilityInput {
  return {
    id: liability.id,
    name: liability.name,
    type: mapLiabilityType(liability.type),
    outstandingMinor: toNumber(liability.outstandingMinor),
    emiMinor: toOptionalNumber(liability.emiMinor),
    interestRate: liability.interestRate === null ? undefined : toNumber(liability.interestRate),
    currency: liability.currency
  };
}

function mapGoal(goal: GoalRow): GoalInput {
  return {
    id: goal.id,
    name: goal.name,
    type: mapGoalType(goal.type),
    targetAmountMinor: toNumber(goal.targetAmountMinor),
    currentAmountMinor: toNumber(goal.currentAmountMinor),
    monthlyContributionMinor: toNumber(goal.monthlyFundingMinor),
    targetDate: goal.targetDate,
    priority: titleCase(goal.priority) as GoalInput["priority"],
    currency: "INR"
  };
}

function buildDashboardTrend(
  snapshots: NetWorthSnapshotRow[],
  current: LedgerDashboardData["netWorth"],
  asOf: Date
) {
  if (snapshots.length === 0) {
    if (current.totalAssetsMinor === 0 && current.totalLiabilitiesMinor === 0) {
      return [];
    }

    return buildNetWorthTrend([
      {
        date: monthLabel(asOf),
        assetsMinor: current.totalAssetsMinor,
        liabilitiesMinor: current.totalLiabilitiesMinor
      }
    ]);
  }

  return buildNetWorthTrend(
    snapshots.map((snapshot) => ({
      date: monthLabel(snapshot.snapshotDate),
      assetsMinor: toNumber(snapshot.totalAssetsMinor),
      liabilitiesMinor: toNumber(snapshot.totalLiabilitiesMinor)
    }))
  );
}

function calculateMonthlyInvestmentProgress(accounts: AccountRow[], goals: GoalInput[], asOf: Date) {
  const plannedMinor = goals.reduce((sum, goal) => sum + goal.monthlyContributionMinor, 0);
  const actualMinor = accounts
    .flatMap((account) => account.transactions)
    .filter((transaction) => transaction.type === "BUY" && sameUtcMonth(transaction.tradeDate, asOf))
    .reduce((sum, transaction) => sum + toNumber(transaction.amountMinor), 0);

  return {
    plannedMinor,
    actualMinor,
    progressPercent: plannedMinor === 0 ? 0 : Math.round((actualMinor / plannedMinor) * 1000) / 10
  };
}

function calculateDiversificationScore(assetClassCount: number) {
  return Math.min(assetClassCount * 25, 100);
}

function uniqueAssetsFromHoldings(holdings: HoldingInput[]): LedgerDashboardData["assets"] {
  const assets = new Map<string, LedgerDashboardData["assets"][number]>();

  for (const holding of holdings) {
    const key = holding.symbol ?? holding.assetName;
    assets.set(key, {
      id: key,
      name: holding.assetName,
      symbol: holding.symbol,
      assetClass: holding.assetClass,
      assetType: holding.assetType
    });
  }

  return [...assets.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function zeroRetirementProjection(): RetirementProjection {
  return {
    currentAge: 0,
    retirementAge: 0,
    currentCorpusMinor: 0,
    monthlyContributionMinor: 0,
    monthlyExpenseMinor: 0,
    inflationRate: 0,
    expectedAnnualReturnRate: 0,
    safeWithdrawalRate: 0,
    yearsToRetirement: 0,
    futureCorpusMinor: 0,
    inflationAdjustedCorpusMinor: 0,
    requiredCorpusMinor: 0,
    safeWithdrawalAnnualMinor: 0,
    readinessPercent: 0,
    yearlyProjection: []
  };
}

function groupBy<T>(values: T[], keyFor: (value: T) => string) {
  const grouped = new Map<string, T[]>();

  for (const value of values) {
    const key = keyFor(value);
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }

  return grouped;
}

function mapProvider(value: string): BrokerSource {
  const providers: Record<string, BrokerSource> = {
    ANGEL_ONE: "Angel One",
    COINDCX: "CoinDCX",
    ZERODHA_KITE: "Zerodha Kite",
    PAYTM_MONEY: "Paytm Money",
    PHONEPE: "PhonePe",
    ICICI_PRUDENTIAL: "ICICI Prudential",
    MANUAL: "Manual",
    OTHER: "Manual"
  };

  return providers[value] ?? "Manual";
}

function mapAssetClass(value: string): AssetClass {
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

  return classes[value] ?? "Alternative";
}

function mapAssetType(value: string): AssetType {
  const types: Record<string, AssetType> = {
    STOCK: "Stock",
    ETF: "ETF",
    MUTUAL_FUND: "Mutual Fund",
    CRYPTO: "Crypto",
    GOLD: "Gold",
    CASH: "Cash",
    FIXED_DEPOSIT: "Fixed Deposit",
    BOND: "Fixed Deposit",
    REAL_ESTATE: "Fixed Deposit",
    OTHER: "Fixed Deposit"
  };

  return types[value] ?? "Fixed Deposit";
}

function mapLiabilityType(value: string): LiabilityInput["type"] {
  if (value === "CREDIT_CARD") {
    return "Credit Card";
  }

  if (value === "EMI") {
    return "EMI";
  }

  return "Loan";
}

function mapGoalType(value: string): GoalInput["type"] {
  const types: Record<string, GoalInput["type"]> = {
    EMERGENCY_FUND: "Emergency Fund",
    HOUSE: "House",
    VEHICLE: "Vehicle",
    RETIREMENT: "Retirement",
    EDUCATION: "Custom",
    CUSTOM: "Custom"
  };

  return types[value] ?? "Custom";
}

function mapInsightType(value: string): InsightItem["type"] {
  const types: Record<string, InsightItem["type"]> = {
    NET_WORTH: "Net Worth",
    GOAL: "Goal",
    RETIREMENT: "Retirement",
    DIVERSIFICATION: "Diversification",
    RISK_CONCENTRATION: "Risk",
    INVESTMENT_DISCIPLINE: "Diversification"
  };

  return types[value] ?? "Net Worth";
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-IN", {
    month: "short",
    timeZone: "UTC"
  });
}

function sameUtcMonth(left: Date, right: Date) {
  return left.getUTCFullYear() === right.getUTCFullYear() && left.getUTCMonth() === right.getUTCMonth();
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function latestDefined<T>(values: Array<T | undefined>) {
  return values.filter((value): value is T => value !== undefined).at(-1);
}

function uniqueStrings(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right));
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return Number(String(value));
}

function toOptionalNumber(value: unknown) {
  return value === null || value === undefined ? undefined : toNumber(value);
}

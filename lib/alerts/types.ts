import type { LedgerDashboardData } from "@/lib/dashboard/ledger-dashboard";
import type { AlertItem, AssetClass } from "@/lib/domain/models";

export type AlertRuleType = "GOAL" | "RETIREMENT" | "PORTFOLIO" | "IMPORT" | "SYSTEM";
export type AlertRuleSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AlertRuleChannel = "IN_APP" | "EMAIL" | "PUSH" | "TELEGRAM";

export type DerivedAlert = {
  id: string;
  userId: string;
  type: AlertRuleType;
  channel: AlertRuleChannel;
  severity: AlertRuleSeverity;
  title: string;
  message: string;
  scheduledFor?: Date;
  metadata: Record<string, unknown>;
};

export type PriceAlertSnapshot = {
  priceMinor: bigint | number;
  currency: string;
  asOf: Date;
  fetchedAt: Date;
  isStale?: boolean;
  provider?: string;
  metadata?: unknown;
};

export type PriceAlertAsset = {
  id: string;
  name: string;
  symbol?: string | null;
  type?: string;
  currency: string;
  metadata?: unknown;
  priceSnapshots?: PriceAlertSnapshot[];
};

export type ImportFailureAlertSource = {
  id: string;
  source: string;
  status: string;
  originalFileName: string;
  validationSummary?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type AlertRuleOptions = {
  dailyChangeWarningPercent: number;
  dailyChangeCriticalPercent: number;
  concentrationWarningPercent: number;
  concentrationCriticalPercent: number;
  allocationDriftWarningPercent: number;
  allocationDriftCriticalPercent: number;
  stalePriceAfterMs: number;
  criticalStalePriceAfterMs: number;
  allocationTargets: Partial<Record<AssetClass, number>>;
};

export type AlertEvaluationInput = {
  userId: string;
  dashboard: LedgerDashboardData;
  priceAssets?: PriceAlertAsset[];
  failedImports?: ImportFailureAlertSource[];
  asOf?: Date;
  options?: Partial<AlertRuleOptions>;
};

export type NotificationAlert = AlertItem & {
  metadata?: unknown;
};

export type NotificationAggregation = {
  totalCount: number;
  unreadCount: number;
  latest: NotificationAlert[];
  bySeverity: {
    info: number;
    warning: number;
    critical: number;
  };
  byType: {
    goal: number;
    retirement: number;
    portfolio: number;
    import: number;
    system: number;
  };
};

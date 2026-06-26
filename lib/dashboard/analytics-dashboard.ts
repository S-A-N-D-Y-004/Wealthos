import {
  calculateAbsoluteReturnPercent,
  calculateMoneyWeightedReturn,
  resolveAnalyticsTimeRange,
  roundReturnPercent,
  summarizeHoldingReturns,
  summarizePortfolioRisk,
  type AnalyticsTimeRangeKind,
  type XirrCashFlow
} from "@/lib/domain/analytics";
import type { LedgerTransactionType } from "@/lib/domain/ledger";
import { percent } from "@/lib/domain/money";
import type { HoldingView } from "@/lib/domain/models";
import type { LedgerDashboardData } from "@/lib/dashboard/ledger-dashboard";

export type AnalyticsDashboardTimeRangeKey = AnalyticsTimeRangeKind;

export type AnalyticsDashboardRangeOption = {
  key: AnalyticsDashboardTimeRangeKey;
  label: string;
};

export type AnalyticsOverview = {
  currentPortfolioValueMinor: number;
  totalInvestedMinor: number;
  totalGainLossMinor: number;
  absoluteReturnPercent: number;
  annualizedReturnPercent: number;
  cagrPercent: number;
  xirrPercent: number;
  moneyWeightedReturnPercent: number;
};

export type AnalyticsRiskCards = {
  riskRating: string;
  diversificationScore: number;
  volatilityPercent: number;
  maximumDrawdownPercent: number;
  largestHoldingPercent: number;
  concentrationLevel: string;
  hhi: number;
};

export type AnalyticsTrendPoint = {
  date: string;
  occurredAtIso: string;
  portfolioValueMinor: number;
  assetsMinor: number;
  liabilitiesMinor: number;
  netWorthMinor: number;
};

export type AnalyticsMonthlyReturnPoint = {
  date: string;
  returnPercent: number;
};

export type AnalyticsAllocationPoint = {
  name: string;
  valueMinor: number;
  allocationPercent: number;
};

export type AnalyticsTopHolding = Pick<
  HoldingView,
  | "id"
  | "assetName"
  | "symbol"
  | "assetClass"
  | "assetType"
  | "accountName"
  | "source"
  | "currentValueMinor"
  | "costBasisMinor"
  | "gainLossMinor"
  | "gainLossPercent"
  | "allocationPercent"
>;

export type AnalyticsRangeView = {
  key: AnalyticsDashboardTimeRangeKey;
  label: string;
  period: {
    startDateIso?: string;
    endDateIso: string;
  };
  overview: AnalyticsOverview;
  risk: AnalyticsRiskCards;
  charts: {
    portfolioGrowth: AnalyticsTrendPoint[];
    netWorthHistory: AnalyticsTrendPoint[];
    monthlyReturns: AnalyticsMonthlyReturnPoint[];
    assetAllocation: AnalyticsAllocationPoint[];
    portfolioAllocation: AnalyticsAllocationPoint[];
  };
};

export type AnalyticsDashboardData = {
  asOfIso: string;
  isEmpty: boolean;
  defaultRangeKey: AnalyticsDashboardTimeRangeKey;
  rangeOptions: AnalyticsDashboardRangeOption[];
  ranges: AnalyticsRangeView[];
  allocations: {
    assetClasses: AnalyticsAllocationPoint[];
    brokerAllocation: AnalyticsAllocationPoint[];
    portfolioComposition: AnalyticsAllocationPoint[];
    topHoldings: AnalyticsTopHolding[];
  };
};

type DashboardTransaction = LedgerDashboardData["transactions"][number];

export const ANALYTICS_TIME_RANGE_OPTIONS: AnalyticsDashboardRangeOption[] = [
  { key: "ONE_MONTH", label: "1M" },
  { key: "THREE_MONTHS", label: "3M" },
  { key: "SIX_MONTHS", label: "6M" },
  { key: "ONE_YEAR", label: "1Y" },
  { key: "SINCE_INCEPTION", label: "Since Inception" },
  { key: "CUSTOM", label: "Custom" }
];

export function buildAnalyticsDashboardData(
  dashboard: LedgerDashboardData,
  { asOf = new Date() }: { asOf?: Date } = {}
): AnalyticsDashboardData {
  const trendPoints = buildTrendPoints(dashboard, asOf);
  const inceptionDate = findInceptionDate(dashboard, trendPoints, asOf);
  const ranges = ANALYTICS_TIME_RANGE_OPTIONS.map((option) =>
    buildRangeView({
      option,
      dashboard,
      asOf,
      inceptionDate,
      trendPoints
    })
  );
  const assetClasses = mapNamedAllocations(dashboard.netWorth.assetAllocation);
  const topHoldings = dashboard.netWorth.holdings.slice(0, 5).map(mapTopHolding);

  return {
    asOfIso: asOf.toISOString(),
    isEmpty: dashboard.holdings.length === 0 && dashboard.netWorth.totalAssetsMinor === 0,
    defaultRangeKey: "SINCE_INCEPTION",
    rangeOptions: ANALYTICS_TIME_RANGE_OPTIONS,
    ranges,
    allocations: {
      assetClasses,
      brokerAllocation: groupHoldingAllocations(dashboard.netWorth.holdings, (holding) => holding.source),
      portfolioComposition: groupHoldingAllocations(dashboard.netWorth.holdings, (holding) => holding.assetType),
      topHoldings
    }
  };
}

export function selectAnalyticsTimeRange(
  dashboard: AnalyticsDashboardData,
  key: AnalyticsDashboardTimeRangeKey
) {
  return dashboard.ranges.find((range) => range.key === key)
    ?? dashboard.ranges.find((range) => range.key === dashboard.defaultRangeKey)
    ?? dashboard.ranges[0];
}

function buildRangeView({
  option,
  dashboard,
  asOf,
  inceptionDate,
  trendPoints
}: {
  option: AnalyticsDashboardRangeOption;
  dashboard: LedgerDashboardData;
  asOf: Date;
  inceptionDate: Date;
  trendPoints: AnalyticsTrendPoint[];
}): AnalyticsRangeView {
  const resolved = option.key === "CUSTOM"
    ? resolveAnalyticsTimeRange({
        kind: "CUSTOM",
        startDate: inceptionDate,
        endDate: asOf
      })
    : resolveAnalyticsTimeRange({ kind: option.key, endDate: asOf }, asOf);
  const startDate = resolved.startDate ?? inceptionDate;
  const rangeTrend = filterTrendPoints(trendPoints, startDate, resolved.endDate);
  const monthlyReturns = buildMonthlyReturns(rangeTrend);
  const returnSummary = summarizeHoldingReturns(dashboard.holdings, {
    startDate,
    endDate: resolved.endDate
  });
  const moneyWeightedReturn = calculateMoneyWeightedReturn({
    cashFlows: buildMoneyWeightedCashFlows(dashboard.transactions, startDate, resolved.endDate),
    currentValueMinor: dashboard.netWorth.totalAssetsMinor,
    valuationDate: resolved.endDate
  });
  const riskSummary = summarizePortfolioRisk({
    holdings: dashboard.holdings,
    valueHistory: rangeTrend.map((point) => ({
      valueMinor: point.portfolioValueMinor,
      occurredAt: new Date(point.occurredAtIso)
    })),
    returnsPercent: monthlyReturns.map((point) => point.returnPercent),
    returnFrequency: "MONTHLY"
  });

  return {
    key: option.key,
    label: option.label,
    period: {
      startDateIso: startDate.toISOString(),
      endDateIso: resolved.endDate.toISOString()
    },
    overview: {
      currentPortfolioValueMinor: returnSummary.currentValueMinor,
      totalInvestedMinor: returnSummary.investedAmountMinor,
      totalGainLossMinor: returnSummary.gainLossMinor,
      absoluteReturnPercent: returnSummary.gainLossPercent,
      annualizedReturnPercent: returnSummary.annualizedReturnPercent,
      cagrPercent: returnSummary.cagrPercent,
      xirrPercent: moneyWeightedReturn.ok ? moneyWeightedReturn.xirrPercent : 0,
      moneyWeightedReturnPercent: moneyWeightedReturn.moneyWeightedReturnPercent
    },
    risk: {
      riskRating: riskSummary.riskRating,
      diversificationScore: riskSummary.diversificationScore,
      volatilityPercent: riskSummary.volatilityPercent,
      maximumDrawdownPercent: riskSummary.maximumDrawdownPercent,
      largestHoldingPercent: riskSummary.largestHoldingPercent,
      concentrationLevel: riskSummary.concentrationRisk,
      hhi: riskSummary.hhi
    },
    charts: {
      portfolioGrowth: rangeTrend,
      netWorthHistory: rangeTrend,
      monthlyReturns,
      assetAllocation: mapNamedAllocations(dashboard.netWorth.assetAllocation),
      portfolioAllocation: dashboard.netWorth.holdings
        .slice(0, 8)
        .map((holding) => ({
          name: holding.symbol ?? holding.assetName,
          valueMinor: holding.currentValueMinor,
          allocationPercent: holding.allocationPercent
        }))
    }
  };
}

function buildTrendPoints(
  dashboard: LedgerDashboardData,
  asOf: Date
): AnalyticsTrendPoint[] {
  const existing = dashboard.netWorthTrend.map((point, index) => {
    const occurredAt = addUtcMonths(asOf, index - dashboard.netWorthTrend.length + 1);

    return {
      date: point.date,
      occurredAtIso: occurredAt.toISOString(),
      portfolioValueMinor: point.assetsMinor,
      assetsMinor: point.assetsMinor,
      liabilitiesMinor: point.liabilitiesMinor,
      netWorthMinor: point.netWorthMinor
    };
  });
  const current = {
    date: monthLabel(asOf),
    occurredAtIso: asOf.toISOString(),
    portfolioValueMinor: dashboard.netWorth.totalAssetsMinor,
    assetsMinor: dashboard.netWorth.totalAssetsMinor,
    liabilitiesMinor: dashboard.netWorth.totalLiabilitiesMinor,
    netWorthMinor: dashboard.netWorth.netWorthMinor
  };

  if (existing.length === 0) {
    return dashboard.netWorth.totalAssetsMinor === 0 && dashboard.netWorth.totalLiabilitiesMinor === 0
      ? []
      : [current];
  }

  const latest = existing.at(-1);

  if (
    latest
    && sameUtcMonth(new Date(latest.occurredAtIso), asOf)
    && latest.assetsMinor === current.assetsMinor
    && latest.liabilitiesMinor === current.liabilitiesMinor
  ) {
    return existing;
  }

  return [...existing, current];
}

function buildMonthlyReturns(points: AnalyticsTrendPoint[]): AnalyticsMonthlyReturnPoint[] {
  return points.slice(1).map((point, index) => {
    const previous = points[index];

    return {
      date: point.date,
      returnPercent: calculateAbsoluteReturnPercent({
        investedAmountMinor: previous.portfolioValueMinor,
        currentValueMinor: point.portfolioValueMinor
      })
    };
  });
}

function filterTrendPoints(
  points: AnalyticsTrendPoint[],
  startDate: Date,
  endDate: Date
) {
  return points.filter((point) => {
    const occurredAt = new Date(point.occurredAtIso);

    return occurredAt >= startDate && occurredAt <= endDate;
  });
}

function buildMoneyWeightedCashFlows(
  transactions: DashboardTransaction[],
  startDate: Date,
  endDate: Date
): XirrCashFlow[] {
  return transactions
    .filter((transaction) => transaction.tradeDate >= startDate && transaction.tradeDate <= endDate)
    .map(transactionToCashFlow)
    .filter((cashFlow): cashFlow is XirrCashFlow => Boolean(cashFlow));
}

function transactionToCashFlow(transaction: DashboardTransaction): XirrCashFlow | undefined {
  const amountMinor = signedCashFlowAmount(transaction.type, transaction.amountMinor);

  if (amountMinor === 0) {
    return undefined;
  }

  return {
    id: transaction.id,
    amountMinor,
    occurredAt: transaction.tradeDate
  };
}

function signedCashFlowAmount(type: LedgerTransactionType, amountMinor: number) {
  const absoluteAmountMinor = Math.abs(amountMinor);

  switch (type) {
    case "BUY":
    case "DEPOSIT":
    case "TRANSFER_IN":
    case "FEE":
    case "TAX":
      return -absoluteAmountMinor;

    case "SELL":
    case "DIVIDEND":
    case "INTEREST":
    case "WITHDRAWAL":
    case "TRANSFER_OUT":
      return absoluteAmountMinor;

    default:
      return 0;
  }
}

function findInceptionDate(
  dashboard: LedgerDashboardData,
  trendPoints: AnalyticsTrendPoint[],
  fallback: Date
) {
  const candidates = [
    ...dashboard.transactions.map((transaction) => transaction.tradeDate),
    ...trendPoints.map((point) => new Date(point.occurredAtIso))
  ].filter(isValidDate);

  return candidates.sort((left, right) => left.getTime() - right.getTime())[0] ?? fallback;
}

function groupHoldingAllocations(
  holdings: HoldingView[],
  keyFor: (holding: HoldingView) => string
): AnalyticsAllocationPoint[] {
  const totalValueMinor = holdings.reduce((sum, holding) => sum + holding.currentValueMinor, 0);
  const grouped = new Map<string, number>();

  for (const holding of holdings) {
    grouped.set(keyFor(holding), (grouped.get(keyFor(holding)) ?? 0) + holding.currentValueMinor);
  }

  return [...grouped.entries()]
    .map(([name, valueMinor]) => ({
      name,
      valueMinor,
      allocationPercent: roundReturnPercent(percent(valueMinor, totalValueMinor))
    }))
    .sort((left, right) => right.valueMinor - left.valueMinor || left.name.localeCompare(right.name));
}

function mapNamedAllocations(
  allocations: LedgerDashboardData["netWorth"]["assetAllocation"]
): AnalyticsAllocationPoint[] {
  return allocations.map((allocation) => ({
    name: allocation.assetClass,
    valueMinor: allocation.valueMinor,
    allocationPercent: allocation.allocationPercent
  }));
}

function mapTopHolding(holding: HoldingView): AnalyticsTopHolding {
  return {
    id: holding.id,
    assetName: holding.assetName,
    symbol: holding.symbol,
    assetClass: holding.assetClass,
    assetType: holding.assetType,
    accountName: holding.accountName,
    source: holding.source,
    currentValueMinor: holding.currentValueMinor,
    costBasisMinor: holding.costBasisMinor,
    gainLossMinor: holding.gainLossMinor,
    gainLossPercent: holding.gainLossPercent,
    allocationPercent: holding.allocationPercent
  };
}

function addUtcMonths(date: Date, deltaMonths: number) {
  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() + deltaMonths;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths - year * 12;
  const day = Math.min(date.getUTCDate(), daysInUtcMonth(year, month));

  return new Date(Date.UTC(
    year,
    month,
    day,
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  ));
}

function daysInUtcMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function sameUtcMonth(left: Date, right: Date) {
  return left.getUTCFullYear() === right.getUTCFullYear() && left.getUTCMonth() === right.getUTCMonth();
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-IN", {
    month: "short",
    timeZone: "UTC"
  });
}

function isValidDate(date: Date) {
  return date instanceof Date && Number.isFinite(date.getTime());
}

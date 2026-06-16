import { createHash } from "node:crypto";
import type { AssetClass, HoldingView } from "@/lib/domain/models";
import type {
  AlertEvaluationInput,
  AlertRuleOptions,
  AlertRuleSeverity,
  DerivedAlert,
  PriceAlertAsset,
  PriceAlertSnapshot
} from "@/lib/alerts/types";

export const DEFAULT_ALERT_RULE_OPTIONS: AlertRuleOptions = {
  dailyChangeWarningPercent: 5,
  dailyChangeCriticalPercent: 10,
  concentrationWarningPercent: 35,
  concentrationCriticalPercent: 50,
  allocationDriftWarningPercent: 10,
  allocationDriftCriticalPercent: 20,
  stalePriceAfterMs: 36 * 60 * 60 * 1000,
  criticalStalePriceAfterMs: 7 * 24 * 60 * 60 * 1000,
  allocationTargets: {}
};

export function evaluateAlertRules(input: AlertEvaluationInput): DerivedAlert[] {
  const asOf = input.asOf ?? new Date();
  const options = {
    ...DEFAULT_ALERT_RULE_OPTIONS,
    ...input.options,
    allocationTargets: {
      ...DEFAULT_ALERT_RULE_OPTIONS.allocationTargets,
      ...input.options?.allocationTargets
    }
  };
  const alerts = [
    ...evaluatePriceAlerts(input.userId, input.priceAssets ?? [], asOf, options),
    ...evaluatePortfolioAlerts(input.userId, input.dashboard, asOf, options),
    ...evaluateGoalAlerts(input.userId, input.dashboard, asOf),
    ...evaluateRetirementAlerts(input.userId, input.dashboard, asOf),
    ...evaluateSystemAlerts(input.userId, input.priceAssets ?? [], input.failedImports ?? [], asOf, options)
  ];

  return dedupeAlerts(alerts).sort(compareAlerts);
}

export function stableAlertId(userId: string, dedupeKey: string) {
  const digest = createHash("sha256").update(`${userId}:${dedupeKey}`).digest("hex").slice(0, 24);
  return `alert_${digest}`;
}

function evaluatePriceAlerts(
  userId: string,
  assets: PriceAlertAsset[],
  asOf: Date,
  options: AlertRuleOptions
): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];

  for (const asset of assets) {
    const snapshots = sortedSnapshots(asset).filter((snapshot) => toNumber(snapshot.priceMinor) > 0);
    const latest = snapshots[0];
    const previous = snapshots[1];

    if (latest && previous) {
      const latestPriceMinor = toNumber(latest.priceMinor);
      const previousPriceMinor = toNumber(previous.priceMinor);
      const changePercent = roundPercent(((latestPriceMinor - previousPriceMinor) / previousPriceMinor) * 100);
      const absoluteChange = Math.abs(changePercent);

      if (absoluteChange >= options.dailyChangeWarningPercent) {
        const severity: AlertRuleSeverity =
          absoluteChange >= options.dailyChangeCriticalPercent ? "CRITICAL" : "WARNING";

        alerts.push(
          createAlert({
            userId,
            type: "PORTFOLIO",
            severity,
            ruleId: "price-daily-change",
            dedupeKey: `price-daily-change:${asset.id}:${dayKey(latest.asOf)}`,
            title: `${assetDisplayName(asset)} moved ${formatSignedPercent(changePercent)}`,
            message: `${assetDisplayName(asset)} changed ${formatSignedPercent(changePercent)} versus the previous price snapshot.`,
            metadata: {
              assetId: asset.id,
              symbol: asset.symbol ?? undefined,
              latestPriceMinor,
              previousPriceMinor,
              changePercent,
              asOf: latest.asOf.toISOString(),
              evaluatedAt: asOf.toISOString()
            }
          })
        );
      }
    }

    if (latest) {
      alerts.push(...evaluateThresholdAlerts(userId, asset, latest, asOf));
    }
  }

  return alerts;
}

function evaluateThresholdAlerts(
  userId: string,
  asset: PriceAlertAsset,
  latest: PriceAlertSnapshot,
  asOf: Date
): DerivedAlert[] {
  const metadata = objectMetadata(asset.metadata);
  const latestPriceMinor = toNumber(latest.priceMinor);
  const aboveMinor = metadataNumber(metadata, ["priceAlertAboveMinor", "alertAboveMinor", "thresholdAboveMinor"]);
  const belowMinor = metadataNumber(metadata, ["priceAlertBelowMinor", "alertBelowMinor", "thresholdBelowMinor"]);
  const alerts: DerivedAlert[] = [];

  if (aboveMinor !== undefined && latestPriceMinor >= aboveMinor) {
    const distancePercent = roundPercent(((latestPriceMinor - aboveMinor) / aboveMinor) * 100);
    alerts.push(
      createAlert({
        userId,
        type: "PORTFOLIO",
        severity: distancePercent >= 10 ? "CRITICAL" : "WARNING",
        ruleId: "price-threshold-above",
        dedupeKey: `price-threshold-above:${asset.id}:${aboveMinor}`,
        title: `${assetDisplayName(asset)} crossed an upper price threshold`,
        message: `${assetDisplayName(asset)} is at ${formatMinor(latestPriceMinor, latest.currency)}, above the configured threshold of ${formatMinor(aboveMinor, latest.currency)}.`,
        metadata: {
          assetId: asset.id,
          symbol: asset.symbol ?? undefined,
          latestPriceMinor,
          thresholdMinor: aboveMinor,
          distancePercent,
          asOf: latest.asOf.toISOString(),
          evaluatedAt: asOf.toISOString()
        }
      })
    );
  }

  if (belowMinor !== undefined && latestPriceMinor <= belowMinor) {
    const distancePercent = roundPercent(((belowMinor - latestPriceMinor) / belowMinor) * 100);
    alerts.push(
      createAlert({
        userId,
        type: "PORTFOLIO",
        severity: distancePercent >= 10 ? "CRITICAL" : "WARNING",
        ruleId: "price-threshold-below",
        dedupeKey: `price-threshold-below:${asset.id}:${belowMinor}`,
        title: `${assetDisplayName(asset)} crossed a lower price threshold`,
        message: `${assetDisplayName(asset)} is at ${formatMinor(latestPriceMinor, latest.currency)}, below the configured threshold of ${formatMinor(belowMinor, latest.currency)}.`,
        metadata: {
          assetId: asset.id,
          symbol: asset.symbol ?? undefined,
          latestPriceMinor,
          thresholdMinor: belowMinor,
          distancePercent,
          asOf: latest.asOf.toISOString(),
          evaluatedAt: asOf.toISOString()
        }
      })
    );
  }

  return alerts;
}

function evaluatePortfolioAlerts(
  userId: string,
  dashboard: AlertEvaluationInput["dashboard"],
  asOf: Date,
  options: AlertRuleOptions
): DerivedAlert[] {
  return [
    ...evaluateConcentrationAlerts(userId, dashboard.netWorth.holdings, dashboard.netWorth.totalAssetsMinor, asOf, options),
    ...evaluateAllocationDriftAlerts(userId, dashboard.netWorth.assetAllocation, asOf, options)
  ];
}

function evaluateConcentrationAlerts(
  userId: string,
  holdings: HoldingView[],
  totalAssetsMinor: number,
  asOf: Date,
  options: AlertRuleOptions
): DerivedAlert[] {
  if (totalAssetsMinor <= 0) {
    return [];
  }

  const byAsset = new Map<string, {
    assetName: string;
    symbol?: string;
    assetClass: AssetClass;
    currentValueMinor: number;
  }>();

  for (const holding of holdings) {
    const key = holding.symbol ?? holding.assetName;
    const existing = byAsset.get(key);

    byAsset.set(key, {
      assetName: holding.assetName,
      symbol: holding.symbol,
      assetClass: holding.assetClass,
      currentValueMinor: (existing?.currentValueMinor ?? 0) + holding.currentValueMinor
    });
  }

  return [...byAsset.values()]
    .map((asset) => ({
      ...asset,
      allocationPercent: roundPercent((asset.currentValueMinor / totalAssetsMinor) * 100)
    }))
    .filter((asset) => asset.allocationPercent >= options.concentrationWarningPercent)
    .map((asset) =>
      createAlert({
        userId,
        type: "PORTFOLIO",
        severity: asset.allocationPercent >= options.concentrationCriticalPercent ? "CRITICAL" : "WARNING",
        ruleId: "portfolio-concentration",
        dedupeKey: `portfolio-concentration:${asset.symbol ?? asset.assetName}`,
        title: `${asset.assetName} concentration is elevated`,
        message: `${asset.assetName} represents ${formatPercent(asset.allocationPercent)} of portfolio assets.`,
        metadata: {
          assetName: asset.assetName,
          symbol: asset.symbol,
          assetClass: asset.assetClass,
          currentValueMinor: asset.currentValueMinor,
          allocationPercent: asset.allocationPercent,
          evaluatedAt: asOf.toISOString()
        }
      })
    );
}

function evaluateAllocationDriftAlerts(
  userId: string,
  allocation: AlertEvaluationInput["dashboard"]["netWorth"]["assetAllocation"],
  asOf: Date,
  options: AlertRuleOptions
): DerivedAlert[] {
  const targets = Object.entries(options.allocationTargets).filter(([, target]) => typeof target === "number");

  if (targets.length === 0) {
    return [];
  }

  const actualByClass = new Map(allocation.map((item) => [item.assetClass, item.allocationPercent]));

  return targets.flatMap(([assetClass, target]) => {
    const targetPercent = target ?? 0;
    const actualPercent = actualByClass.get(assetClass) ?? 0;
    const driftPercent = roundPercent(actualPercent - targetPercent);
    const absoluteDrift = Math.abs(driftPercent);

    if (absoluteDrift < options.allocationDriftWarningPercent) {
      return [];
    }

    return [
      createAlert({
        userId,
        type: "PORTFOLIO",
        severity: absoluteDrift >= options.allocationDriftCriticalPercent ? "CRITICAL" : "WARNING",
        ruleId: "asset-allocation-drift",
        dedupeKey: `asset-allocation-drift:${assetClass}`,
        title: `${assetClass} allocation drift detected`,
        message: `${assetClass} allocation is ${formatPercent(actualPercent)} versus a target of ${formatPercent(targetPercent)}.`,
        metadata: {
          assetClass,
          targetPercent,
          actualPercent,
          driftPercent,
          evaluatedAt: asOf.toISOString()
        }
      })
    ];
  });
}

function evaluateGoalAlerts(
  userId: string,
  dashboard: AlertEvaluationInput["dashboard"],
  asOf: Date
): DerivedAlert[] {
  return dashboard.goalSummary.forecasts
    .filter((goal) => !goal.isOnTrack && goal.fundingGapMinor > 0)
    .map((goal) =>
      createAlert({
        userId,
        type: "GOAL",
        severity: goal.priority === "Critical" ? "CRITICAL" : "WARNING",
        ruleId: "goal-behind-schedule",
        dedupeKey: `goal-behind-schedule:${goal.id}`,
        title: `${goal.name} is behind schedule`,
        message: `${goal.name} needs ${formatMinor(goal.monthlyRequiredMinor, goal.currency)} per month to stay on schedule based on the current target date.`,
        metadata: {
          goalId: goal.id,
          goalType: goal.type,
          priority: goal.priority,
          fundingGapMinor: goal.fundingGapMinor,
          monthlyContributionMinor: goal.monthlyContributionMinor,
          monthlyRequiredMinor: goal.monthlyRequiredMinor,
          targetDate: goal.targetDate.toISOString(),
          evaluatedAt: asOf.toISOString()
        }
      })
    );
}

function evaluateRetirementAlerts(
  userId: string,
  dashboard: AlertEvaluationInput["dashboard"],
  asOf: Date
): DerivedAlert[] {
  const projection = dashboard.retirementProjection;

  if (projection.yearsToRetirement <= 0 || projection.requiredCorpusMinor <= 0) {
    return [];
  }

  const fundingGapMinor = projection.requiredCorpusMinor - projection.futureCorpusMinor;

  if (fundingGapMinor <= 0) {
    return [];
  }

  return [
    createAlert({
      userId,
      type: "RETIREMENT",
      severity: projection.readinessPercent < 70 ? "CRITICAL" : "WARNING",
      ruleId: "retirement-funding-gap",
      dedupeKey: "retirement-funding-gap",
      title: "Retirement funding gap detected",
      message: `Projected retirement corpus is below the required corpus by ${formatMinor(fundingGapMinor, "INR")} under current assumptions.`,
      metadata: {
        yearsToRetirement: projection.yearsToRetirement,
        futureCorpusMinor: projection.futureCorpusMinor,
        requiredCorpusMinor: projection.requiredCorpusMinor,
        readinessPercent: projection.readinessPercent,
        fundingGapMinor,
        evaluatedAt: asOf.toISOString()
      }
    })
  ];
}

function evaluateSystemAlerts(
  userId: string,
  assets: PriceAlertAsset[],
  failedImports: AlertEvaluationInput["failedImports"],
  asOf: Date,
  options: AlertRuleOptions
): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];

  for (const asset of assets) {
    const latest = sortedSnapshots(asset)[0];

    if (!latest) {
      continue;
    }

    const staleForMs = asOf.getTime() - latest.fetchedAt.getTime();

    if (!latest.isStale && staleForMs < options.stalePriceAfterMs) {
      continue;
    }

    alerts.push(
      createAlert({
        userId,
        type: "SYSTEM",
        severity: staleForMs >= options.criticalStalePriceAfterMs ? "CRITICAL" : "WARNING",
        ruleId: "stale-price",
        dedupeKey: `stale-price:${asset.id}:${dayKey(asOf)}`,
        title: `${assetDisplayName(asset)} price is stale`,
        message: `${assetDisplayName(asset)} price data was last fetched on ${dayKey(latest.fetchedAt)}.`,
        metadata: {
          assetId: asset.id,
          symbol: asset.symbol ?? undefined,
          fetchedAt: latest.fetchedAt.toISOString(),
          asOf: latest.asOf.toISOString(),
          staleForMs,
          evaluatedAt: asOf.toISOString()
        }
      })
    );
  }

  for (const failure of failedImports ?? []) {
    if (failure.status !== "FAILED") {
      continue;
    }

    alerts.push(
      createAlert({
        userId,
        type: "IMPORT",
        severity: "WARNING",
        ruleId: "import-failure",
        dedupeKey: `import-failure:${failure.id}`,
        title: "Import failed",
        message: `${failure.originalFileName} from ${titleCase(failure.source)} did not complete successfully.`,
        metadata: {
          importJobId: failure.id,
          source: failure.source,
          originalFileName: failure.originalFileName,
          validationSummary: failure.validationSummary,
          updatedAt: failure.updatedAt.toISOString(),
          evaluatedAt: asOf.toISOString()
        }
      })
    );
  }

  return alerts;
}

function createAlert(input: {
  userId: string;
  type: DerivedAlert["type"];
  severity: AlertRuleSeverity;
  ruleId: string;
  dedupeKey: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
}): DerivedAlert {
  return {
    id: stableAlertId(input.userId, input.dedupeKey),
    userId: input.userId,
    type: input.type,
    channel: "IN_APP",
    severity: input.severity,
    title: input.title,
    message: input.message,
    metadata: {
      ruleId: input.ruleId,
      ...input.metadata
    }
  };
}

function sortedSnapshots(asset: PriceAlertAsset) {
  return [...(asset.priceSnapshots ?? [])].sort((left, right) => right.asOf.getTime() - left.asOf.getTime());
}

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function metadataNumber(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : undefined;

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function dedupeAlerts(alerts: DerivedAlert[]) {
  const byId = new Map<string, DerivedAlert>();

  for (const alert of alerts) {
    const existing = byId.get(alert.id);

    if (!existing || severityRank(alert.severity) > severityRank(existing.severity)) {
      byId.set(alert.id, alert);
    }
  }

  return [...byId.values()];
}

function compareAlerts(left: DerivedAlert, right: DerivedAlert) {
  return severityRank(right.severity) - severityRank(left.severity)
    || left.type.localeCompare(right.type)
    || left.title.localeCompare(right.title);
}

function severityRank(severity: AlertRuleSeverity) {
  const ranks: Record<AlertRuleSeverity, number> = {
    INFO: 1,
    WARNING: 2,
    CRITICAL: 3
  };

  return ranks[severity];
}

function assetDisplayName(asset: PriceAlertAsset) {
  return asset.symbol ? `${asset.name} (${asset.symbol})` : asset.name;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${formatPercent(value)}`;
}

function formatPercent(value: number) {
  return `${roundPercent(value).toFixed(1)}%`;
}

function formatMinor(amountMinor: number, currency: string) {
  return `${currency} ${(amountMinor / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}`;
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

function toNumber(value: bigint | number) {
  return typeof value === "bigint" ? Number(value) : value;
}

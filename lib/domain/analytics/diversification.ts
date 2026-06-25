import { clamp } from "@/lib/domain/money";
import { roundReturnPercent } from "@/lib/domain/analytics/returns";
import type { AssetClass } from "@/lib/domain/models";

export type PortfolioAllocation = {
  id?: string;
  assetClass: AssetClass | string;
  currentValueMinor: number;
};

export type ConcentrationClassification = "Low" | "Moderate" | "High";

export type ConcentrationRiskResult = {
  largestHoldingPercent: number;
  topFiveHoldingsPercent: number;
  hhi: number;
  classification: ConcentrationClassification;
  holdingCount: number;
};

type NormalizedAllocation = PortfolioAllocation & {
  weight: number;
};

const TARGET_HOLDING_COUNT = 10;
const TARGET_ASSET_CLASS_COUNT = 4;
const HOLDING_COUNT_WEIGHT = 0.2;
const HOLDING_CONCENTRATION_WEIGHT = 0.45;
const ASSET_CLASS_SPREAD_WEIGHT = 0.35;

export function calculateConcentrationRisk(
  holdings: readonly PortfolioAllocation[]
): ConcentrationRiskResult {
  const allocations = normalizeAllocations(holdings);

  if (allocations.length === 0) {
    return {
      largestHoldingPercent: 0,
      topFiveHoldingsPercent: 0,
      hhi: 0,
      classification: "Low",
      holdingCount: 0
    };
  }

  const weightsDescending = allocations
    .map((allocation) => allocation.weight)
    .sort((left, right) => right - left);
  const largestHoldingPercent = weightsDescending[0] * 100;
  const topFiveHoldingsPercent = weightsDescending
    .slice(0, 5)
    .reduce((sum, weight) => sum + weight, 0) * 100;
  // HHI uses the conventional 0-10,000 market-concentration scale.
  const hhi = allocations.reduce(
    (sum, allocation) => sum + Math.pow(allocation.weight * 100, 2),
    0
  );

  return {
    largestHoldingPercent: roundReturnPercent(largestHoldingPercent),
    topFiveHoldingsPercent: roundReturnPercent(topFiveHoldingsPercent),
    hhi: roundMetric(hhi),
    classification: classifyConcentration(largestHoldingPercent, hhi),
    holdingCount: allocations.length
  };
}

export function calculateDiversificationScore(
  holdings: readonly PortfolioAllocation[]
) {
  const allocations = normalizeAllocations(holdings);

  if (allocations.length <= 1) {
    return 0;
  }

  const holdingCountScore = clamp(
    allocations.length / TARGET_HOLDING_COUNT * 100,
    0,
    100
  );
  const holdingHhi = allocations.reduce(
    (sum, allocation) => sum + Math.pow(allocation.weight, 2),
    0
  );
  const holdingConcentrationScore = (1 - holdingHhi) * 100;
  const assetClassSpreadScore = calculateAssetClassSpreadScore(allocations);
  // Holdings breadth, holding concentration, and asset-class spread are
  // intentionally separate so a large single-class portfolio cannot score as fully diversified.
  const score =
    holdingCountScore * HOLDING_COUNT_WEIGHT
    + holdingConcentrationScore * HOLDING_CONCENTRATION_WEIGHT
    + assetClassSpreadScore * ASSET_CLASS_SPREAD_WEIGHT;

  return roundReturnPercent(clamp(score, 0, 100));
}

function calculateAssetClassSpreadScore(allocations: readonly NormalizedAllocation[]) {
  const weightsByAssetClass = new Map<string, number>();

  for (const allocation of allocations) {
    weightsByAssetClass.set(
      allocation.assetClass,
      (weightsByAssetClass.get(allocation.assetClass) ?? 0) + allocation.weight
    );
  }

  if (weightsByAssetClass.size <= 1) {
    return 0;
  }

  const classHhi = [...weightsByAssetClass.values()].reduce(
    (sum, weight) => sum + Math.pow(weight, 2),
    0
  );
  const classConcentrationScore = (1 - classHhi) * 100;
  const classBreadthScore = clamp(
    weightsByAssetClass.size / TARGET_ASSET_CLASS_COUNT * 100,
    0,
    100
  );

  return (classConcentrationScore + classBreadthScore) / 2;
}

function normalizeAllocations(
  holdings: readonly PortfolioAllocation[]
): NormalizedAllocation[] {
  const validHoldings = holdings.filter(
    (holding) =>
      holding
      && typeof holding.assetClass === "string"
      && holding.assetClass.length > 0
      && Number.isInteger(holding.currentValueMinor)
      && holding.currentValueMinor > 0
  );
  const totalValueMinor = validHoldings.reduce(
    (sum, holding) => sum + holding.currentValueMinor,
    0
  );

  if (totalValueMinor <= 0) {
    return [];
  }

  return validHoldings.map((holding) => ({
    ...holding,
    weight: holding.currentValueMinor / totalValueMinor
  }));
}

function classifyConcentration(
  largestHoldingPercent: number,
  hhi: number
): ConcentrationClassification {
  if (largestHoldingPercent >= 50 || hhi > 2500) {
    return "High";
  }

  if (largestHoldingPercent >= 35 || hhi >= 1500) {
    return "Moderate";
  }

  return "Low";
}

function roundMetric(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 10) / 10;
}

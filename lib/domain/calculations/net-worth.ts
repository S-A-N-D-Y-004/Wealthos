import { percent } from "@/lib/domain/money";
import type { HoldingInput, HoldingView, LiabilityInput } from "@/lib/domain/models";

export type NetWorthSnapshotResult = {
  totalAssetsMinor: number;
  totalLiabilitiesMinor: number;
  netWorthMinor: number;
  assetAllocation: Array<{
    assetClass: string;
    valueMinor: number;
    allocationPercent: number;
  }>;
  holdings: HoldingView[];
};

export function calculateNetWorth(
  holdings: HoldingInput[],
  liabilities: LiabilityInput[]
): NetWorthSnapshotResult {
  const totalAssetsMinor = holdings.reduce((sum, item) => sum + item.currentValueMinor, 0);
  const totalLiabilitiesMinor = liabilities.reduce((sum, item) => sum + item.outstandingMinor, 0);
  const allocationByClass = new Map<string, number>();

  for (const holding of holdings) {
    allocationByClass.set(
      holding.assetClass,
      (allocationByClass.get(holding.assetClass) ?? 0) + holding.currentValueMinor
    );
  }

  const assetAllocation = Array.from(allocationByClass.entries())
    .map(([assetClass, valueMinor]) => ({
      assetClass,
      valueMinor,
      allocationPercent: roundPercent(percent(valueMinor, totalAssetsMinor))
    }))
    .sort((left, right) => right.valueMinor - left.valueMinor || left.assetClass.localeCompare(right.assetClass));

  const holdingViews = holdings
    .map((holding) => {
      const gainLossMinor = holding.currentValueMinor - holding.costBasisMinor;
      const gainLossPercent = roundPercent(percent(gainLossMinor, holding.costBasisMinor));
      const allocationPercent = roundPercent(percent(holding.currentValueMinor, totalAssetsMinor));

      return {
        ...holding,
        gainLossMinor,
        gainLossPercent,
        allocationPercent
      };
    })
    .sort((left, right) => right.currentValueMinor - left.currentValueMinor);

  return {
    totalAssetsMinor,
    totalLiabilitiesMinor,
    netWorthMinor: totalAssetsMinor - totalLiabilitiesMinor,
    assetAllocation,
    holdings: holdingViews
  };
}

export function buildNetWorthTrend(points: Array<{ date: string; assetsMinor: number; liabilitiesMinor: number }>) {
  return points.map((point) => ({
    date: point.date,
    assetsMinor: point.assetsMinor,
    liabilitiesMinor: point.liabilitiesMinor,
    netWorthMinor: point.assetsMinor - point.liabilitiesMinor
  }));
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

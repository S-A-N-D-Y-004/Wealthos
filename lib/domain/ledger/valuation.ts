import type { HoldingInput } from "@/lib/domain/models";

export type PortfolioValuationResult = {
  totalValueMinor: number;

  assetAllocation: Array<{
    assetClass: string;
    valueMinor: number;
    allocationPercent: number;
  }>;
};

export function calculatePortfolioValuation(
  holdings: HoldingInput[]
): PortfolioValuationResult {
  const totalValueMinor = holdings.reduce(
    (sum, holding) => sum + holding.currentValueMinor,
    0
  );

  const allocations = new Map<string, number>();

  for (const holding of holdings) {
    allocations.set(
      holding.assetClass,
      (allocations.get(holding.assetClass) ?? 0) +
        holding.currentValueMinor
    );
  }

  const assetAllocation = Array.from(
    allocations.entries()
  )
    .map(([assetClass, valueMinor]) => ({
      assetClass,
      valueMinor,
      allocationPercent:
        totalValueMinor === 0
          ? 0
          : Math.round(
              (valueMinor / totalValueMinor) *
                1000
            ) / 10
    }))
    .sort(
      (a, b) => b.valueMinor - a.valueMinor || a.assetClass.localeCompare(b.assetClass)
    );

  return {
    totalValueMinor,
    assetAllocation
  };
}

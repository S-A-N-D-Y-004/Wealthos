import type { HoldingInput, LiabilityInput } from "@/lib/domain/models";

export type SnapshotResult = {
  snapshotDate: Date;

  totalAssetsMinor: number;

  totalLiabilitiesMinor: number;

  netWorthMinor: number;

  holdingsDigest: {
    totalHoldings: number;
    assetClasses: string[];
  };
};

export function generateSnapshot(
  holdings: HoldingInput[],
  liabilities: LiabilityInput[],
  snapshotDate = new Date()
): SnapshotResult {
  const totalAssetsMinor = holdings.reduce(
    (sum, holding) => sum + holding.currentValueMinor,
    0
  );

  const totalLiabilitiesMinor = liabilities.reduce(
    (sum, liability) => sum + liability.outstandingMinor,
    0
  );

  const assetClasses = [
    ...new Set(
      holdings.map((holding) => holding.assetClass)
    )
  ];

  return {
    snapshotDate,

    totalAssetsMinor,

    totalLiabilitiesMinor,

    netWorthMinor:
      totalAssetsMinor - totalLiabilitiesMinor,

    holdingsDigest: {
      totalHoldings: holdings.length,
      assetClasses
    }
  };
}
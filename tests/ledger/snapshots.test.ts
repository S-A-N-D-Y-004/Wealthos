import { describe, expect, it } from "vitest";
import { generateSnapshot } from "@/lib/domain/ledger";
import type { HoldingInput, LiabilityInput } from "@/lib/domain/models";

function holding(input: Pick<HoldingInput, "id" | "assetClass" | "currentValueMinor">): HoldingInput {
  return {
    accountName: "Account",
    source: "Manual",
    assetName: input.id,
    assetType: "Stock",
    quantity: 1,
    averageCostMinor: input.currentValueMinor,
    currentPriceMinor: input.currentValueMinor,
    costBasisMinor: input.currentValueMinor,
    currency: "INR",
    ...input
  };
}

function liability(input: Pick<LiabilityInput, "id" | "outstandingMinor">): LiabilityInput {
  return {
    name: input.id,
    type: "Loan",
    currency: "INR",
    ...input
  };
}

describe("generateSnapshot", () => {
  it("calculates net worth from holdings and liabilities", () => {
    const snapshotDate = new Date("2026-01-31T00:00:00.000Z");
    const result = generateSnapshot(
      [
        holding({ id: "equity-1", assetClass: "Equity", currentValueMinor: 250000 }),
        holding({ id: "cash-1", assetClass: "Cash", currentValueMinor: 50000 })
      ],
      [liability({ id: "home-loan", outstandingMinor: 125000 })],
      snapshotDate
    );

    expect(result).toEqual({
      snapshotDate,
      totalAssetsMinor: 300000,
      totalLiabilitiesMinor: 125000,
      netWorthMinor: 175000,
      holdingsDigest: {
        totalHoldings: 2,
        assetClasses: ["Equity", "Cash"]
      }
    });
  });

  it("handles multiple liabilities", () => {
    const result = generateSnapshot(
      [holding({ id: "equity-1", assetClass: "Equity", currentValueMinor: 500000 })],
      [
        liability({ id: "home-loan", outstandingMinor: 150000 }),
        liability({ id: "credit-card", outstandingMinor: 25000 })
      ],
      new Date("2026-02-01T00:00:00.000Z")
    );

    expect(result.totalLiabilitiesMinor).toBe(175000);
    expect(result.netWorthMinor).toBe(325000);
  });

  it("handles empty portfolios deterministically", () => {
    const snapshotDate = new Date("2026-03-01T00:00:00.000Z");
    const result = generateSnapshot([], [], snapshotDate);

    expect(result).toEqual({
      snapshotDate,
      totalAssetsMinor: 0,
      totalLiabilitiesMinor: 0,
      netWorthMinor: 0,
      holdingsDigest: {
        totalHoldings: 0,
        assetClasses: []
      }
    });
  });
});

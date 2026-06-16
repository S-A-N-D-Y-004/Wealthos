import { describe, expect, it } from "vitest";
import { calculatePortfolioValuation } from "@/lib/domain/ledger";
import type { HoldingInput } from "@/lib/domain/models";

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

describe("calculatePortfolioValuation", () => {
  it("calculates total portfolio value", () => {
    const result = calculatePortfolioValuation([
      holding({ id: "equity-1", assetClass: "Equity", currentValueMinor: 150000 }),
      holding({ id: "gold-1", assetClass: "Gold", currentValueMinor: 50000 })
    ]);

    expect(result.totalValueMinor).toBe(200000);
  });

  it("calculates asset allocation percentages by asset class", () => {
    const result = calculatePortfolioValuation([
      holding({ id: "equity-1", assetClass: "Equity", currentValueMinor: 150000 }),
      holding({ id: "equity-2", assetClass: "Equity", currentValueMinor: 50000 }),
      holding({ id: "cash-1", assetClass: "Cash", currentValueMinor: 100000 })
    ]);

    expect(result.assetAllocation).toEqual([
      { assetClass: "Equity", valueMinor: 200000, allocationPercent: 66.7 },
      { assetClass: "Cash", valueMinor: 100000, allocationPercent: 33.3 }
    ]);
  });

  it("returns zero allocations for empty portfolios", () => {
    expect(calculatePortfolioValuation([])).toEqual({
      totalValueMinor: 0,
      assetAllocation: []
    });
  });
});

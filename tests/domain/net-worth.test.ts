import { describe, expect, it } from "vitest";
import { calculateNetWorth } from "@/lib/domain/calculations/net-worth";

describe("calculateNetWorth", () => {
  it("calculates assets, liabilities, net worth, gains, and allocation", () => {
    const result = calculateNetWorth(
      [
        {
          id: "h1",
          accountName: "Broker",
          source: "Manual",
          assetName: "Index ETF",
          assetClass: "Equity",
          assetType: "ETF",
          quantity: 10,
          averageCostMinor: 10000,
          currentPriceMinor: 15000,
          costBasisMinor: 100000,
          currentValueMinor: 150000,
          currency: "INR"
        },
        {
          id: "h2",
          accountName: "Bank",
          source: "Manual",
          assetName: "Cash",
          assetClass: "Cash",
          assetType: "Cash",
          quantity: 1,
          averageCostMinor: 50000,
          currentPriceMinor: 50000,
          costBasisMinor: 50000,
          currentValueMinor: 50000,
          currency: "INR"
        }
      ],
      [
        {
          id: "l1",
          name: "Loan",
          type: "Loan",
          outstandingMinor: 60000,
          currency: "INR"
        }
      ]
    );

    expect(result.totalAssetsMinor).toBe(200000);
    expect(result.totalLiabilitiesMinor).toBe(60000);
    expect(result.netWorthMinor).toBe(140000);
    expect(result.assetAllocation).toEqual([
      { assetClass: "Equity", valueMinor: 150000, allocationPercent: 75 },
      { assetClass: "Cash", valueMinor: 50000, allocationPercent: 25 }
    ]);
    expect(result.holdings[0].gainLossMinor).toBe(50000);
    expect(result.holdings[0].gainLossPercent).toBe(50);
  });
});


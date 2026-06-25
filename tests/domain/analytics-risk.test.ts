import { describe, expect, it } from "vitest";
import {
  calculateConcentrationRisk,
  calculateDiversificationScore,
  calculateMaximumDrawdown,
  calculatePortfolioVolatility,
  summarizePortfolioRisk,
  type PortfolioAllocation,
  type PortfolioValuePoint
} from "@/lib/domain/analytics";

describe("portfolio risk analytics", () => {
  it("returns deterministic zero states for an empty portfolio", () => {
    expect(calculateMaximumDrawdown([])).toEqual({
      peakValueMinor: 0,
      troughValueMinor: 0,
      maximumDrawdownPercent: 0,
      recoveryAmountMinor: 0,
      observationCount: 0
    });
    expect(calculatePortfolioVolatility({
      returnsPercent: [],
      frequency: "DAILY"
    })).toEqual({
      standardDeviationPercent: 0,
      annualizedVolatilityPercent: 0,
      observationCount: 0,
      periodsPerYear: 252
    });
    expect(summarizePortfolioRisk({
      holdings: [],
      valueHistory: [],
      returnsPercent: [],
      returnFrequency: "DAILY"
    })).toEqual({
      volatilityPercent: 0,
      maximumDrawdownPercent: 0,
      diversificationScore: 0,
      concentrationRisk: "Low",
      largestHoldingPercent: 0,
      hhi: 0,
      riskRating: "Very Low"
    });
  });

  it("calculates peak, trough, drawdown, and recovery amount", () => {
    expect(calculateMaximumDrawdown(valueHistory([
      100000,
      150000,
      120000,
      90000,
      110000
    ]))).toEqual({
      peakValueMinor: 150000,
      troughValueMinor: 90000,
      maximumDrawdownPercent: 40,
      recoveryAmountMinor: 60000,
      observationCount: 5
    });
  });

  it("returns zero drawdown for rising and flat portfolios", () => {
    expect(calculateMaximumDrawdown(valueHistory([
      100000,
      120000,
      140000
    ]))).toMatchObject({
      peakValueMinor: 140000,
      troughValueMinor: 140000,
      maximumDrawdownPercent: 0,
      recoveryAmountMinor: 0
    });
    expect(calculateMaximumDrawdown(valueHistory([
      100000,
      100000,
      100000
    ]))).toMatchObject({
      peakValueMinor: 100000,
      troughValueMinor: 100000,
      maximumDrawdownPercent: 0
    });
  });

  it("annualizes daily volatility using sample standard deviation", () => {
    expect(calculatePortfolioVolatility({
      returnsPercent: [1, -1, 1, -1],
      frequency: "DAILY"
    })).toEqual({
      standardDeviationPercent: 1.2,
      annualizedVolatilityPercent: 18.3,
      observationCount: 4,
      periodsPerYear: 252
    });
  });

  it("supports low weekly and flat monthly return series", () => {
    expect(calculatePortfolioVolatility({
      returnsPercent: [0.1, 0.2, 0.1, 0.2],
      frequency: "WEEKLY"
    })).toMatchObject({
      standardDeviationPercent: 0.1,
      annualizedVolatilityPercent: 0.4,
      periodsPerYear: 52
    });
    expect(calculatePortfolioVolatility({
      returnsPercent: [1, 1, 1],
      frequency: "MONTHLY"
    })).toEqual({
      standardDeviationPercent: 0,
      annualizedVolatilityPercent: 0,
      observationCount: 3,
      periodsPerYear: 12
    });
  });

  it("identifies high volatility deterministically", () => {
    expect(calculatePortfolioVolatility({
      returnsPercent: [10, -10, 10, -10],
      frequency: "DAILY"
    }).annualizedVolatilityPercent).toBe(183.3);
  });

  it("classifies a single holding as highly concentrated", () => {
    const holdings = [allocation("Equity", 100000)];

    expect(calculateConcentrationRisk(holdings)).toEqual({
      largestHoldingPercent: 100,
      topFiveHoldingsPercent: 100,
      hhi: 10000,
      classification: "High",
      holdingCount: 1
    });
    expect(calculateDiversificationScore(holdings)).toBe(0);
  });

  it("scores a diversified multi-asset portfolio highly", () => {
    const assetClasses = ["Equity", "Debt", "Gold", "Cash", "Real Estate"];
    const holdings = Array.from({ length: 10 }, (_, index) =>
      allocation(assetClasses[index % assetClasses.length], 100000)
    );

    expect(calculateConcentrationRisk(holdings)).toEqual({
      largestHoldingPercent: 10,
      topFiveHoldingsPercent: 50,
      hhi: 1000,
      classification: "Low",
      holdingCount: 10
    });
    expect(calculateDiversificationScore(holdings)).toBe(92);
  });

  it("calculates equal-weight portfolio concentration consistently", () => {
    const holdings = [
      allocation("Equity", 100000),
      allocation("Debt", 100000),
      allocation("Gold", 100000),
      allocation("Cash", 100000)
    ];

    expect(calculateConcentrationRisk(holdings)).toMatchObject({
      largestHoldingPercent: 25,
      topFiveHoldingsPercent: 100,
      hhi: 2500,
      classification: "Moderate"
    });
    expect(calculateDiversificationScore(holdings)).toBe(72.4);
  });

  it("detects highly concentrated portfolios", () => {
    const holdings = [
      allocation("Equity", 900000),
      allocation("Debt", 50000),
      allocation("Gold", 50000)
    ];

    expect(calculateConcentrationRisk(holdings)).toMatchObject({
      largestHoldingPercent: 90,
      topFiveHoldingsPercent: 100,
      hhi: 8150,
      classification: "High"
    });
    expect(calculateDiversificationScore(holdings)).toBe(30.7);
  });

  it("summarizes low-risk diversified portfolios", () => {
    expect(summarizePortfolioRisk({
      holdings: diversifiedHoldings(),
      valueHistory: valueHistory([1000000, 1010000, 1020000]),
      returnsPercent: [0.1, 0.2, 0.1, 0.2],
      returnFrequency: "WEEKLY"
    })).toMatchObject({
      volatilityPercent: 0.4,
      maximumDrawdownPercent: 0,
      diversificationScore: 92,
      concentrationRisk: "Low",
      largestHoldingPercent: 10,
      hhi: 1000,
      riskRating: "Very Low"
    });
  });

  it("rates concentration, drawdown, and volatility conservatively", () => {
    const concentrated = [
      allocation("Equity", 900000),
      allocation("Debt", 50000),
      allocation("Gold", 50000)
    ];

    expect(summarizePortfolioRisk({
      holdings: concentrated,
      valueHistory: valueHistory([1000000, 1000000]),
      returnsPercent: [0, 0],
      returnFrequency: "MONTHLY"
    }).riskRating).toBe("High");
    expect(summarizePortfolioRisk({
      holdings: diversifiedHoldings(),
      valueHistory: valueHistory([1000000, 600000]),
      returnsPercent: [0, 0],
      returnFrequency: "MONTHLY"
    }).riskRating).toBe("Very High");
    expect(summarizePortfolioRisk({
      holdings: diversifiedHoldings(),
      valueHistory: valueHistory([1000000, 1000000]),
      returnsPercent: [10, -10, 10, -10],
      returnFrequency: "DAILY"
    }).riskRating).toBe("Very High");
  });

  it("supports low and moderate unified risk ratings", () => {
    expect(summarizePortfolioRisk({
      holdings: diversifiedHoldings(),
      valueHistory: valueHistory([1000000, 1000000]),
      returnsPercent: [2, -2, 2, -2],
      returnFrequency: "MONTHLY"
    })).toMatchObject({
      volatilityPercent: 8,
      riskRating: "Low"
    });
    expect(summarizePortfolioRisk({
      holdings: diversifiedHoldings(),
      valueHistory: valueHistory([1000000, 1000000]),
      returnsPercent: [4, -4, 4, -4],
      returnFrequency: "MONTHLY"
    })).toMatchObject({
      volatilityPercent: 16,
      riskRating: "Moderate"
    });
  });

  it("rates a single-holding portfolio as very high risk", () => {
    expect(summarizePortfolioRisk({
      holdings: [allocation("Equity", 100000)],
      valueHistory: valueHistory([100000, 100000]),
      returnsPercent: [0, 0],
      returnFrequency: "MONTHLY"
    })).toMatchObject({
      diversificationScore: 0,
      concentrationRisk: "High",
      largestHoldingPercent: 100,
      hhi: 10000,
      riskRating: "Very High"
    });
  });

  it("handles large datasets without changing deterministic results", () => {
    const history = Array.from({ length: 10000 }, (_, index) => ({
      valueMinor: 100000 + index
    }));
    const returns = Array.from({ length: 10000 }, () => 0);

    expect(calculateMaximumDrawdown(history)).toMatchObject({
      peakValueMinor: 109999,
      troughValueMinor: 109999,
      maximumDrawdownPercent: 0,
      observationCount: 10000
    });
    expect(calculatePortfolioVolatility({
      returnsPercent: returns,
      frequency: "DAILY"
    })).toMatchObject({
      standardDeviationPercent: 0,
      annualizedVolatilityPercent: 0,
      observationCount: 10000
    });
  });

  it("rounds drawdown and concentration metrics consistently", () => {
    expect(calculateMaximumDrawdown(valueHistory([
      300,
      200
    ])).maximumDrawdownPercent).toBe(33.3);
    expect(calculateConcentrationRisk([
      allocation("Equity", 200),
      allocation("Debt", 100)
    ])).toMatchObject({
      largestHoldingPercent: 66.7,
      hhi: 5555.6
    });
  });
});

function allocation(
  assetClass: string,
  currentValueMinor: number
): PortfolioAllocation {
  return {
    assetClass,
    currentValueMinor
  };
}

function diversifiedHoldings() {
  const assetClasses = ["Equity", "Debt", "Gold", "Cash", "Real Estate"];

  return Array.from({ length: 10 }, (_, index) =>
    allocation(assetClasses[index % assetClasses.length], 100000)
  );
}

function valueHistory(values: number[]): PortfolioValuePoint[] {
  return values.map((valueMinor) => ({ valueMinor }));
}

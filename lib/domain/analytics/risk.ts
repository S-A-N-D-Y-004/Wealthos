import {
  calculateConcentrationRisk,
  calculateDiversificationScore,
  type ConcentrationClassification,
  type PortfolioAllocation
} from "@/lib/domain/analytics/diversification";
import {
  calculateMaximumDrawdown,
  type PortfolioValuePoint
} from "@/lib/domain/analytics/drawdown";
import {
  calculatePortfolioVolatility,
  type ReturnFrequency
} from "@/lib/domain/analytics/volatility";

export type PortfolioRiskRating =
  | "Very Low"
  | "Low"
  | "Moderate"
  | "High"
  | "Very High";

export type PortfolioRiskSummaryInput = {
  holdings: readonly PortfolioAllocation[];
  valueHistory: readonly PortfolioValuePoint[];
  returnsPercent: readonly number[];
  returnFrequency: ReturnFrequency;
};

export type PortfolioRiskSummary = {
  volatilityPercent: number;
  maximumDrawdownPercent: number;
  diversificationScore: number;
  concentrationRisk: ConcentrationClassification;
  largestHoldingPercent: number;
  hhi: number;
  riskRating: PortfolioRiskRating;
};

const RISK_RATINGS: PortfolioRiskRating[] = [
  "Very Low",
  "Low",
  "Moderate",
  "High",
  "Very High"
];

export function summarizePortfolioRisk(
  input: PortfolioRiskSummaryInput
): PortfolioRiskSummary {
  const volatility = calculatePortfolioVolatility({
    returnsPercent: input.returnsPercent,
    frequency: input.returnFrequency
  });
  const drawdown = calculateMaximumDrawdown(input.valueHistory);
  const concentration = calculateConcentrationRisk(input.holdings);
  const diversificationScore = calculateDiversificationScore(input.holdings);
  const riskLevels: number[] = [];

  if (volatility.observationCount >= 2) {
    riskLevels.push(volatilityRiskLevel(volatility.annualizedVolatilityPercent));
  }

  if (drawdown.observationCount > 0) {
    riskLevels.push(drawdownRiskLevel(drawdown.maximumDrawdownPercent));
  }

  if (concentration.holdingCount > 0) {
    riskLevels.push(concentrationRiskLevel(concentration.classification));
    riskLevels.push(diversificationRiskLevel(diversificationScore));
  }

  // The highest available dimension determines the rating so severe risk is
  // not hidden by averaging it with missing or low-risk measurements.
  return {
    volatilityPercent: volatility.annualizedVolatilityPercent,
    maximumDrawdownPercent: drawdown.maximumDrawdownPercent,
    diversificationScore,
    concentrationRisk: concentration.classification,
    largestHoldingPercent: concentration.largestHoldingPercent,
    hhi: concentration.hhi,
    riskRating: RISK_RATINGS[Math.max(0, ...riskLevels)]
  };
}

function volatilityRiskLevel(volatilityPercent: number) {
  if (volatilityPercent >= 35) {
    return 4;
  }

  if (volatilityPercent >= 20) {
    return 3;
  }

  if (volatilityPercent >= 10) {
    return 2;
  }

  if (volatilityPercent >= 5) {
    return 1;
  }

  return 0;
}

function drawdownRiskLevel(drawdownPercent: number) {
  if (drawdownPercent >= 35) {
    return 4;
  }

  if (drawdownPercent >= 20) {
    return 3;
  }

  if (drawdownPercent >= 10) {
    return 2;
  }

  if (drawdownPercent >= 5) {
    return 1;
  }

  return 0;
}

function concentrationRiskLevel(classification: ConcentrationClassification) {
  if (classification === "High") {
    return 3;
  }

  if (classification === "Moderate") {
    return 2;
  }

  return 0;
}

function diversificationRiskLevel(diversificationScore: number) {
  if (diversificationScore < 20) {
    return 4;
  }

  if (diversificationScore < 40) {
    return 3;
  }

  if (diversificationScore < 60) {
    return 2;
  }

  if (diversificationScore < 80) {
    return 1;
  }

  return 0;
}

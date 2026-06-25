import { roundReturnPercent } from "@/lib/domain/analytics/returns";

export type ReturnFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export type PortfolioVolatilityInput = {
  returnsPercent: readonly number[];
  frequency: ReturnFrequency;
};

export type PortfolioVolatilityResult = {
  standardDeviationPercent: number;
  annualizedVolatilityPercent: number;
  observationCount: number;
  periodsPerYear: number;
};

const PERIODS_PER_YEAR: Record<ReturnFrequency, number> = {
  DAILY: 252,
  WEEKLY: 52,
  MONTHLY: 12
};

export function calculatePortfolioVolatility(
  input: PortfolioVolatilityInput
): PortfolioVolatilityResult {
  const periodsPerYear = PERIODS_PER_YEAR[input.frequency];
  const returns = input.returnsPercent.filter(Number.isFinite);

  if (returns.length < 2) {
    return {
      standardDeviationPercent: 0,
      annualizedVolatilityPercent: 0,
      observationCount: returns.length,
      periodsPerYear
    };
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const squaredDeviations = returns.reduce(
    (sum, value) => sum + Math.pow(value - mean, 2),
    0
  );
  const standardDeviation = Math.sqrt(squaredDeviations / (returns.length - 1));

  return {
    standardDeviationPercent: roundReturnPercent(standardDeviation),
    annualizedVolatilityPercent: roundReturnPercent(
      standardDeviation * Math.sqrt(periodsPerYear)
    ),
    observationCount: returns.length,
    periodsPerYear
  };
}

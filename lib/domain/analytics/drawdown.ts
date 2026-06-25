import { roundReturnPercent } from "@/lib/domain/analytics/returns";

export type PortfolioValuePoint = {
  valueMinor: number;
  occurredAt?: Date;
};

export type MaximumDrawdownResult = {
  peakValueMinor: number;
  troughValueMinor: number;
  maximumDrawdownPercent: number;
  recoveryAmountMinor: number;
  observationCount: number;
};

export function calculateMaximumDrawdown(
  history: readonly PortfolioValuePoint[]
): MaximumDrawdownResult {
  const values = history
    .map((point) => point?.valueMinor)
    .filter(isValidPortfolioValue);

  if (values.length === 0) {
    return emptyDrawdownResult();
  }

  let runningPeak = values[0];
  let maximumDrawdown = 0;
  let peakValueMinor = values[0];
  let troughValueMinor = values[0];

  for (const valueMinor of values.slice(1)) {
    if (valueMinor >= runningPeak) {
      runningPeak = valueMinor;

      if (maximumDrawdown === 0) {
        peakValueMinor = valueMinor;
        troughValueMinor = valueMinor;
      }

      continue;
    }

    if (runningPeak === 0) {
      continue;
    }

    const drawdown = (runningPeak - valueMinor) / runningPeak;

    if (drawdown > maximumDrawdown) {
      maximumDrawdown = drawdown;
      peakValueMinor = runningPeak;
      troughValueMinor = valueMinor;
    }
  }

  return {
    peakValueMinor,
    troughValueMinor,
    maximumDrawdownPercent: roundReturnPercent(maximumDrawdown * 100),
    recoveryAmountMinor: peakValueMinor - troughValueMinor,
    observationCount: values.length
  };
}

function emptyDrawdownResult(): MaximumDrawdownResult {
  return {
    peakValueMinor: 0,
    troughValueMinor: 0,
    maximumDrawdownPercent: 0,
    recoveryAmountMinor: 0,
    observationCount: 0
  };
}

function isValidPortfolioValue(value: number | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

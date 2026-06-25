import {
  calculateAbsoluteReturnPercent,
  roundReturnPercent,
  type ReturnInput
} from "@/lib/domain/analytics/returns";

export type PeriodReturnInput = ReturnInput & {
  startDate: Date;
  endDate: Date;
};

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export function calculateCagrPercent(input: PeriodReturnInput) {
  const years = calculateInvestmentPeriodYears(input.startDate, input.endDate);

  if (years <= 0 || input.investedAmountMinor <= 0 || input.currentValueMinor < 0) {
    return 0;
  }

  if (input.currentValueMinor === 0) {
    return -100;
  }

  const growthRatio = input.currentValueMinor / input.investedAmountMinor;
  const cagr = (Math.pow(growthRatio, 1 / years) - 1) * 100;

  return roundReturnPercent(cagr);
}

export function calculateAnnualizedReturnPercent(input: PeriodReturnInput) {
  return calculateCagrPercent(input);
}

export function calculateSimpleAnnualizedReturnPercent(input: PeriodReturnInput) {
  const years = calculateInvestmentPeriodYears(input.startDate, input.endDate);

  if (years <= 0) {
    return 0;
  }

  return roundReturnPercent(calculateAbsoluteReturnPercent(input) / years);
}

export function calculateInvestmentPeriodYears(startDate: Date, endDate: Date) {
  if (!isValidDate(startDate) || !isValidDate(endDate) || endDate <= startDate) {
    return 0;
  }

  return (endDate.getTime() - startDate.getTime()) / MS_PER_YEAR;
}

function isValidDate(date: Date) {
  return date instanceof Date && Number.isFinite(date.getTime());
}

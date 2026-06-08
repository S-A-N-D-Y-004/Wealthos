import { clamp, percent } from "@/lib/domain/money";

export type RetirementInput = {
  currentAge: number;
  retirementAge: number;
  currentCorpusMinor: number;
  monthlyContributionMinor: number;
  monthlyExpenseMinor: number;
  inflationRate: number;
  expectedAnnualReturnRate: number;
  safeWithdrawalRate: number;
};

export type RetirementProjection = RetirementInput & {
  yearsToRetirement: number;
  futureCorpusMinor: number;
  inflationAdjustedCorpusMinor: number;
  requiredCorpusMinor: number;
  safeWithdrawalAnnualMinor: number;
  readinessPercent: number;
  yearlyProjection: Array<{
    age: number;
    corpusMinor: number;
    inflationAdjustedCorpusMinor: number;
  }>;
};

export function projectRetirement(input: RetirementInput): RetirementProjection {
  if (input.retirementAge <= input.currentAge) {
    throw new Error("Retirement age must be greater than current age.");
  }

  if (input.safeWithdrawalRate <= 0) {
    throw new Error("Safe withdrawal rate must be greater than zero.");
  }

  const yearsToRetirement = input.retirementAge - input.currentAge;
  const monthlyReturn = Math.pow(1 + input.expectedAnnualReturnRate, 1 / 12) - 1;
  const months = yearsToRetirement * 12;
  let corpusMinor = input.currentCorpusMinor;
  const yearlyProjection: RetirementProjection["yearlyProjection"] = [];

  for (let month = 1; month <= months; month += 1) {
    corpusMinor = corpusMinor * (1 + monthlyReturn) + input.monthlyContributionMinor;

    if (month % 12 === 0) {
      const yearsElapsed = month / 12;
      yearlyProjection.push({
        age: input.currentAge + yearsElapsed,
        corpusMinor: Math.round(corpusMinor),
        inflationAdjustedCorpusMinor: Math.round(corpusMinor / Math.pow(1 + input.inflationRate, yearsElapsed))
      });
    }
  }

  const inflatedAnnualExpenseMinor =
    input.monthlyExpenseMinor * 12 * Math.pow(1 + input.inflationRate, yearsToRetirement);
  const requiredCorpusMinor = Math.round(inflatedAnnualExpenseMinor / input.safeWithdrawalRate);
  const futureCorpusMinor = Math.round(corpusMinor);
  const inflationAdjustedCorpusMinor = Math.round(
    futureCorpusMinor / Math.pow(1 + input.inflationRate, yearsToRetirement)
  );
  const safeWithdrawalAnnualMinor = Math.round(futureCorpusMinor * input.safeWithdrawalRate);

  return {
    ...input,
    yearsToRetirement,
    futureCorpusMinor,
    inflationAdjustedCorpusMinor,
    requiredCorpusMinor,
    safeWithdrawalAnnualMinor,
    readinessPercent: Math.round(clamp(percent(futureCorpusMinor, requiredCorpusMinor), 0, 150)),
    yearlyProjection
  };
}


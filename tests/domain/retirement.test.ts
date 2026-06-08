import { describe, expect, it } from "vitest";
import { projectRetirement } from "@/lib/domain/calculations/retirement";

describe("projectRetirement", () => {
  it("projects monthly compounding and readiness", () => {
    const result = projectRetirement({
      currentAge: 40,
      retirementAge: 42,
      currentCorpusMinor: 1000000,
      monthlyContributionMinor: 10000,
      monthlyExpenseMinor: 50000,
      inflationRate: 0.05,
      expectedAnnualReturnRate: 0.12,
      safeWithdrawalRate: 0.04
    });

    expect(result.yearsToRetirement).toBe(2);
    expect(result.yearlyProjection).toHaveLength(2);
    expect(result.futureCorpusMinor).toBeGreaterThan(1240000);
    expect(result.requiredCorpusMinor).toBeGreaterThan(15000000);
    expect(result.readinessPercent).toBeGreaterThan(0);
  });

  it("rejects invalid retirement ages", () => {
    expect(() =>
      projectRetirement({
        currentAge: 55,
        retirementAge: 55,
        currentCorpusMinor: 1000000,
        monthlyContributionMinor: 10000,
        monthlyExpenseMinor: 50000,
        inflationRate: 0.05,
        expectedAnnualReturnRate: 0.12,
        safeWithdrawalRate: 0.04
      })
    ).toThrow("Retirement age must be greater than current age.");
  });
});


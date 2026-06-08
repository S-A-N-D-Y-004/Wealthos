import { describe, expect, it } from "vitest";
import { forecastGoal, summarizeGoals } from "@/lib/domain/calculations/goals";

describe("goal forecasting", () => {
  const today = new Date("2026-06-08T00:00:00.000Z");

  it("calculates progress, funding gap, required funding, and track status", () => {
    const forecast = forecastGoal(
      {
        id: "g1",
        name: "Emergency Fund",
        type: "Emergency Fund",
        targetAmountMinor: 1200000,
        currentAmountMinor: 600000,
        monthlyContributionMinor: 100000,
        targetDate: new Date("2026-12-08T00:00:00.000Z"),
        priority: "Critical",
        currency: "INR"
      },
      today
    );

    expect(forecast.progressPercent).toBe(50);
    expect(forecast.fundingGapMinor).toBe(600000);
    expect(forecast.monthlyRequiredMinor).toBe(100000);
    expect(forecast.isOnTrack).toBe(true);
    expect(forecast.estimatedCompletionDate?.toISOString()).toBe("2026-12-08T00:00:00.000Z");
  });

  it("summarizes aggregate goal progress and critical off-track goals", () => {
    const summary = summarizeGoals(
      [
        {
          id: "g1",
          name: "Retirement",
          type: "Retirement",
          targetAmountMinor: 1000000,
          currentAmountMinor: 250000,
          monthlyContributionMinor: 10000,
          targetDate: new Date("2026-12-08T00:00:00.000Z"),
          priority: "Critical",
          currency: "INR"
        },
        {
          id: "g2",
          name: "Vehicle",
          type: "Vehicle",
          targetAmountMinor: 500000,
          currentAmountMinor: 250000,
          monthlyContributionMinor: 50000,
          targetDate: new Date("2027-06-08T00:00:00.000Z"),
          priority: "Medium",
          currency: "INR"
        }
      ],
      today
    );

    expect(summary.aggregateProgressPercent).toBe(33.3);
    expect(summary.criticalOffTrack).toHaveLength(1);
    expect(summary.criticalOffTrack[0].name).toBe("Retirement");
  });
});


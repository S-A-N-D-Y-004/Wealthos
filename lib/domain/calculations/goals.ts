import { clamp, percent } from "@/lib/domain/money";
import type { GoalInput } from "@/lib/domain/models";

export type GoalForecast = GoalInput & {
  progressPercent: number;
  fundingGapMinor: number;
  monthsRemaining: number;
  estimatedCompletionDate: Date | null;
  monthlyRequiredMinor: number;
  isOnTrack: boolean;
};

export function forecastGoal(goal: GoalInput, today = new Date()): GoalForecast {
  const fundingGapMinor = Math.max(goal.targetAmountMinor - goal.currentAmountMinor, 0);
  const monthsRemaining = monthsBetween(today, goal.targetDate);
  const progressPercent = clamp(percent(goal.currentAmountMinor, goal.targetAmountMinor), 0, 100);
  const monthlyRequiredMinor =
    monthsRemaining === 0 ? fundingGapMinor : Math.ceil(fundingGapMinor / monthsRemaining);
  const estimatedCompletionDate =
    fundingGapMinor === 0
      ? today
      : goal.monthlyContributionMinor <= 0
        ? null
        : addMonths(today, Math.ceil(fundingGapMinor / goal.monthlyContributionMinor));

  return {
    ...goal,
    progressPercent: roundPercent(progressPercent),
    fundingGapMinor,
    monthsRemaining,
    estimatedCompletionDate,
    monthlyRequiredMinor,
    isOnTrack: fundingGapMinor === 0 || goal.monthlyContributionMinor >= monthlyRequiredMinor
  };
}

export function summarizeGoals(goals: GoalInput[], today = new Date()) {
  const forecasts = goals.map((goal) => forecastGoal(goal, today));
  const totalTargetMinor = goals.reduce((sum, goal) => sum + goal.targetAmountMinor, 0);
  const totalCurrentMinor = goals.reduce((sum, goal) => sum + goal.currentAmountMinor, 0);
  const criticalOffTrack = forecasts.filter(
    (goal) => (goal.priority === "High" || goal.priority === "Critical") && !goal.isOnTrack
  );

  return {
    forecasts,
    totalTargetMinor,
    totalCurrentMinor,
    aggregateProgressPercent: roundPercent(clamp(percent(totalCurrentMinor, totalTargetMinor), 0, 100)),
    criticalOffTrack
  };
}

export function monthsBetween(start: Date, end: Date) {
  if (end <= start) {
    return 0;
  }

  const yearDelta = end.getUTCFullYear() - start.getUTCFullYear();
  const monthDelta = end.getUTCMonth() - start.getUTCMonth();
  const partialMonth = end.getUTCDate() > start.getUTCDate() ? 1 : 0;

  return Math.max(yearDelta * 12 + monthDelta + partialMonth, 0);
}

export function addMonths(date: Date, months: number) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}


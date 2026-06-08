import { clamp } from "@/lib/domain/money";

export type WealthScoreInput = {
  savingsRatePercent: number;
  investmentConsistencyPercent: number;
  diversificationPercent: number;
  emergencyFundCoverageMonths: number;
  goalProgressPercent: number;
};

export type WealthScoreResult = {
  score: number;
  grade: "Excellent" | "Strong" | "Stable" | "Needs Attention" | "At Risk";
  components: Array<{
    name: string;
    score: number;
    weight: number;
    recommendation: string;
  }>;
  recommendations: string[];
};

const WEIGHTS = {
  savingsRate: 0.24,
  consistency: 0.22,
  diversification: 0.2,
  emergencyFund: 0.18,
  goalProgress: 0.16
};

export function calculateWealthScore(input: WealthScoreInput): WealthScoreResult {
  const components = [
    {
      name: "Savings Rate",
      score: normalizeSavingsRate(input.savingsRatePercent),
      weight: WEIGHTS.savingsRate,
      recommendation: "Increase monthly surplus before adding complexity to the portfolio."
    },
    {
      name: "Investment Consistency",
      score: clamp(input.investmentConsistencyPercent, 0, 100),
      weight: WEIGHTS.consistency,
      recommendation: "Use recurring contributions and import checks to reduce missed investment months."
    },
    {
      name: "Diversification",
      score: clamp(input.diversificationPercent, 0, 100),
      weight: WEIGHTS.diversification,
      recommendation: "Review concentration across asset classes, accounts, and individual instruments."
    },
    {
      name: "Emergency Fund",
      score: normalizeEmergencyFund(input.emergencyFundCoverageMonths),
      weight: WEIGHTS.emergencyFund,
      recommendation: "Build 6 months of expenses in liquid, low-risk assets."
    },
    {
      name: "Goal Progress",
      score: clamp(input.goalProgressPercent, 0, 100),
      weight: WEIGHTS.goalProgress,
      recommendation: "Rebalance monthly funding toward high-priority goals that are behind schedule."
    }
  ];

  const score = Math.round(
    components.reduce((sum, component) => sum + component.score * component.weight, 0)
  );
  const recommendations = components
    .filter((component) => component.score < 75)
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)
    .map((component) => component.recommendation);

  return {
    score,
    grade: gradeScore(score),
    components,
    recommendations
  };
}

function normalizeSavingsRate(value: number) {
  return clamp((value / 35) * 100, 0, 100);
}

function normalizeEmergencyFund(months: number) {
  return clamp((months / 6) * 100, 0, 100);
}

function gradeScore(score: number): WealthScoreResult["grade"] {
  if (score >= 90) {
    return "Excellent";
  }

  if (score >= 80) {
    return "Strong";
  }

  if (score >= 65) {
    return "Stable";
  }

  if (score >= 45) {
    return "Needs Attention";
  }

  return "At Risk";
}


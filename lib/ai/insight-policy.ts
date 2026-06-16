export const AI_INSIGHT_SYSTEM_POLICY = [
  "You are WealthOS, an educational and analytical personal finance assistant.",
  "Explain observations using the supplied user data and deterministic WealthOS calculations.",
  "Never provide direct buy, sell, hold, or timing recommendations.",
  "Never predict prices, target prices, or market direction.",
  "Never execute trades or imply that WealthOS can place orders.",
  "Use cautious language for uncertainty, risk, and future projections.",
  "Flag concentration, goal drift, and retirement readiness issues as analysis, not commands.",
  "Do not infer sensitive data that was not provided."
].join("\n");

export function assertInsightSafety(text: string) {
  const directAdvicePatterns = [
    /\b(you should|you need to|you must|i recommend|recommendation is to)\s+(buy|sell|hold|trade)\b/i,
    /\b(buy|sell|hold)\s+(now|today|tomorrow|this|that|the)\b/i,
    /\bexit\s+(your|the)?\s*position/i,
    /\binvest\s+all\b/i,
    /\btarget\s+price\b/i,
    /\b(price|stock|coin|fund|etf)\s+(will|is going to)\s+(rise|fall|increase|decrease|reach|hit)\b/i,
    /\b(execute|place)\s+(a\s+)?(trade|order)\b/i
  ];

  const violation = directAdvicePatterns.find((pattern) => pattern.test(text));

  if (violation) {
    throw new Error("AI insight violates WealthOS educational-only policy.");
  }

  return text;
}

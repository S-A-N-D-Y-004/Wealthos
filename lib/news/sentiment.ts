import type { NewsProviderArticle, NewsSentimentResult } from "@/lib/news/types";

const POSITIVE_TERMS = [
  "beats",
  "beat estimates",
  "profit",
  "profits",
  "growth",
  "record",
  "raises",
  "upgrade",
  "upgraded",
  "approval",
  "partnership",
  "expansion",
  "strong demand",
  "surge",
  "wins",
  "launches"
];

const NEGATIVE_TERMS = [
  "misses",
  "loss",
  "losses",
  "lawsuit",
  "fraud",
  "probe",
  "investigation",
  "downgrade",
  "downgraded",
  "bankruptcy",
  "default",
  "hack",
  "breach",
  "regulatory",
  "penalty",
  "fine",
  "crash",
  "slump",
  "falls",
  "cuts guidance"
];

const SIGNIFICANT_EVENT_TERMS = [
  "earnings",
  "merger",
  "acquisition",
  "lawsuit",
  "fraud",
  "investigation",
  "bankruptcy",
  "default",
  "hack",
  "breach",
  "regulatory",
  "penalty",
  "split",
  "dividend",
  "leadership change"
];

export function analyzeNewsSentiment(article: Pick<NewsProviderArticle, "title" | "summary">): NewsSentimentResult {
  const text = `${article.title} ${article.summary ?? ""}`.toLowerCase();
  const positiveMatches = matchedTerms(text, POSITIVE_TERMS);
  const negativeMatches = matchedTerms(text, NEGATIVE_TERMS);
  const significantEvents = matchedTerms(text, SIGNIFICANT_EVENT_TERMS);
  const rawScore = positiveMatches.length - negativeMatches.length;
  const denominator = Math.max(positiveMatches.length + negativeMatches.length, 1);
  const score = roundScore(rawScore / denominator);

  return {
    label: score <= -0.35 ? "NEGATIVE" : score >= 0.35 ? "POSITIVE" : "NEUTRAL",
    score,
    positiveMatches,
    negativeMatches,
    significantEvents
  };
}

export function isStrongNegativeSentiment(sentiment: NewsSentimentResult) {
  return sentiment.label === "NEGATIVE" && sentiment.score <= -0.6;
}

export function isSignificantNewsEvent(sentiment: NewsSentimentResult) {
  return sentiment.significantEvents.length > 0;
}

function matchedTerms(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(term));
}

function roundScore(value: number) {
  return Math.round(value * 1000) / 1000;
}

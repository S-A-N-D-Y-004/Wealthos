import { describe, expect, it } from "vitest";
import {
  analyzeNewsSentiment,
  isSignificantNewsEvent,
  isStrongNegativeSentiment
} from "@/lib/news";

describe("news sentiment analysis", () => {
  it("classifies positive, neutral, and negative sentiment deterministically", () => {
    expect(analyzeNewsSentiment({
      title: "Company beats estimates and reports record profit growth"
    })).toMatchObject({
      label: "POSITIVE",
      score: 1
    });

    expect(analyzeNewsSentiment({
      title: "Company publishes quarterly update"
    })).toMatchObject({
      label: "NEUTRAL",
      score: 0
    });

    expect(analyzeNewsSentiment({
      title: "Company faces fraud investigation and regulatory penalty"
    })).toMatchObject({
      label: "NEGATIVE",
      score: -1
    });
  });

  it("flags strong negative sentiment and significant events", () => {
    const sentiment = analyzeNewsSentiment({
      title: "Crypto exchange suffers hack and regulatory investigation",
      summary: "The breach may lead to a penalty."
    });

    expect(isStrongNegativeSentiment(sentiment)).toBe(true);
    expect(isSignificantNewsEvent(sentiment)).toBe(true);
    expect(sentiment.significantEvents).toEqual(["investigation", "hack", "breach", "regulatory", "penalty"]);
  });
});

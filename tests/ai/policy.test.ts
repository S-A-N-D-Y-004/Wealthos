import { describe, expect, it } from "vitest";
import { assertInsightSafety } from "@/lib/ai";

describe("AI insight safety policy", () => {
  it("rejects direct buy, sell, hold, and timing instructions", () => {
    expect(() => assertInsightSafety("You should buy NIFTYBEES today.")).toThrow(
      "AI insight violates WealthOS educational-only policy."
    );
    expect(() => assertInsightSafety("I recommend sell BTC.")).toThrow(
      "AI insight violates WealthOS educational-only policy."
    );
    expect(() => assertInsightSafety("Hold now and wait for a breakout.")).toThrow(
      "AI insight violates WealthOS educational-only policy."
    );
  });

  it("rejects price predictions and trade execution language", () => {
    expect(() => assertInsightSafety("The target price is INR 500.")).toThrow(
      "AI insight violates WealthOS educational-only policy."
    );
    expect(() => assertInsightSafety("The stock will rise next week.")).toThrow(
      "AI insight violates WealthOS educational-only policy."
    );
    expect(() => assertInsightSafety("I can execute a trade for you.")).toThrow(
      "AI insight violates WealthOS educational-only policy."
    );
  });

  it("allows educational analysis language", () => {
    expect(
      assertInsightSafety("The allocation is concentrated, so this is useful context for risk review.")
    ).toBe("The allocation is concentrated, so this is useful context for risk review.");
  });
});

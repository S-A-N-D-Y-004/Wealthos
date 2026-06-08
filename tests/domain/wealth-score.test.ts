import { describe, expect, it } from "vitest";
import { calculateWealthScore } from "@/lib/domain/calculations/wealth-score";

describe("calculateWealthScore", () => {
  it("scores weighted financial health components", () => {
    const result = calculateWealthScore({
      savingsRatePercent: 35,
      investmentConsistencyPercent: 80,
      diversificationPercent: 70,
      emergencyFundCoverageMonths: 6,
      goalProgressPercent: 50
    });

    expect(result.score).toBe(82);
    expect(result.grade).toBe("Strong");
    expect(result.components).toHaveLength(5);
    expect(result.recommendations[0]).toContain("Rebalance monthly funding");
  });
});


export type XirrCashFlow = {
  id?: string;
  amountMinor: number;
  occurredAt: Date;
};

export type XirrInput = {
  cashFlows: XirrCashFlow[];
  guessPercent?: number;
  maxIterations?: number;
  tolerance?: number;
};

export type XirrResult = {
  xirrPercent: number;
  iterations: number;
  converged: boolean;
};

export function calculateXirr(input: XirrInput): XirrResult {
  void input;

  // TODO(Issue #10B): implement deterministic money-weighted XIRR for irregular cash flows.
  throw new Error("XIRR calculation is not implemented yet.");
}

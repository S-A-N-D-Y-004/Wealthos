import { roundReturnPercent } from "@/lib/domain/analytics/returns";

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

export type XirrCalculationMethod = "NEWTON_RAPHSON" | "BISECTION" | "NONE";

export type XirrErrorCode =
  | "INVALID_CASH_FLOWS"
  | "INSUFFICIENT_CASH_FLOWS"
  | "MISSING_NEGATIVE_CASH_FLOW"
  | "MISSING_POSITIVE_CASH_FLOW"
  | "IDENTICAL_DATES"
  | "INVALID_OPTIONS"
  | "NO_SOLUTION"
  | "NO_CONVERGENCE";

export type XirrError = {
  code: XirrErrorCode;
  message: string;
};

export type XirrSuccessResult = {
  ok: true;
  xirrPercent: number;
  rate: number;
  iterations: number;
  converged: true;
  method: Exclude<XirrCalculationMethod, "NONE">;
};

export type XirrFailureResult = {
  ok: false;
  xirrPercent: 0;
  rate: 0;
  iterations: number;
  converged: false;
  method: XirrCalculationMethod;
  error: XirrError;
};

export type XirrResult = XirrSuccessResult | XirrFailureResult;

export type MoneyWeightedReturnInput = XirrInput & {
  currentValueMinor?: number;
  valuationDate?: Date;
};

export type MoneyWeightedReturnResult = XirrResult & {
  moneyWeightedReturnPercent: number;
};

type PreparedCashFlow = XirrCashFlow & {
  yearsSinceStart: number;
};

type SolverResult =
  | {
      ok: true;
      rate: number;
      iterations: number;
    }
  | {
      ok: false;
      iterations: number;
    };

const DEFAULT_GUESS_PERCENT = 10;
const DEFAULT_MAX_ITERATIONS = 100;
const DEFAULT_TOLERANCE = 0.0000001;
const RATE_TOLERANCE = 0.0000000001;
const DAYS_PER_YEAR = 365.25;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_RATE = -0.999999999;
const MAX_RATE = 1_000_000;
const BISECTION_CANDIDATES = [
  MIN_RATE,
  -0.999999,
  -0.9999,
  -0.99,
  -0.9,
  -0.75,
  -0.5,
  -0.25,
  0,
  0.1,
  0.25,
  0.5,
  1,
  2,
  5,
  10,
  25,
  50,
  100,
  250,
  500,
  1_000,
  10_000,
  100_000,
  MAX_RATE
];

export function calculateXirr(input: XirrInput): XirrResult {
  const options = normalizeOptions(input);

  if (!options.ok) {
    return failure(options.error, 0, "NONE");
  }

  const prepared = prepareCashFlows(input?.cashFlows);

  if (!prepared.ok) {
    return failure(prepared.error, 0, "NONE");
  }

  const newton = solveWithNewton(prepared.cashFlows, options.guessRate, options.maxIterations, options.tolerance);

  if (newton.ok) {
    return success(newton.rate, newton.iterations, "NEWTON_RAPHSON");
  }

  const bisection = solveWithBisection(prepared.cashFlows, options.maxIterations, options.tolerance);

  if (bisection.ok) {
    return success(bisection.rate, bisection.iterations, "BISECTION");
  }

  return failure(
    {
      code: bisection.iterations === 0 ? "NO_SOLUTION" : "NO_CONVERGENCE",
      message:
        bisection.iterations === 0
          ? "Cash flows do not bracket a deterministic XIRR solution."
          : "XIRR calculation did not converge within the configured iteration limit."
    },
    Math.max(newton.iterations, bisection.iterations),
    bisection.iterations > 0 ? "BISECTION" : "NONE"
  );
}

export function calculateMoneyWeightedReturn(input: MoneyWeightedReturnInput): MoneyWeightedReturnResult {
  if (!Array.isArray(input?.cashFlows)) {
    return {
      ...failure(
        {
          code: "INVALID_CASH_FLOWS",
          message: "cashFlows must be an array."
        },
        0,
        "NONE"
      ),
      moneyWeightedReturnPercent: 0
    };
  }

  const cashFlows = [...input.cashFlows];

  if (input?.currentValueMinor !== undefined) {
    if (!isValidDate(input.valuationDate)) {
      return {
        ...failure(
          {
            code: "INVALID_OPTIONS",
            message: "valuationDate is required when currentValueMinor is provided."
          },
          0,
          "NONE"
        ),
        moneyWeightedReturnPercent: 0
      };
    }

    cashFlows.push({
      amountMinor: input.currentValueMinor,
      occurredAt: input.valuationDate
    });
  }

  const result = calculateXirr({
    ...input,
    cashFlows
  });

  return {
    ...result,
    moneyWeightedReturnPercent: result.ok ? result.xirrPercent : 0
  };
}

export function calculateXnpv(cashFlows: XirrCashFlow[], rate: number) {
  const prepared = prepareCashFlows(cashFlows);

  if (!prepared.ok) {
    return 0;
  }

  return calculateNetPresentValue(prepared.cashFlows, rate);
}

function normalizeOptions(input: XirrInput | undefined) {
  const maxIterations = input?.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const tolerance = input?.tolerance ?? DEFAULT_TOLERANCE;
  const guessPercent = input?.guessPercent ?? DEFAULT_GUESS_PERCENT;

  if (!Number.isInteger(maxIterations) || maxIterations <= 0) {
    return {
      ok: false as const,
      error: {
        code: "INVALID_OPTIONS" as const,
        message: "maxIterations must be a positive integer."
      }
    };
  }

  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    return {
      ok: false as const,
      error: {
        code: "INVALID_OPTIONS" as const,
        message: "tolerance must be greater than zero."
      }
    };
  }

  if (!Number.isFinite(guessPercent) || guessPercent / 100 <= MIN_RATE || guessPercent / 100 > MAX_RATE) {
    return {
      ok: false as const,
      error: {
        code: "INVALID_OPTIONS" as const,
        message: "guessPercent must represent a finite rate greater than -100%."
      }
    };
  }

  return {
    ok: true as const,
    guessRate: guessPercent / 100,
    maxIterations,
    tolerance
  };
}

function prepareCashFlows(cashFlows: XirrCashFlow[] | undefined) {
  if (!Array.isArray(cashFlows)) {
    return {
      ok: false as const,
      error: {
        code: "INVALID_CASH_FLOWS" as const,
        message: "cashFlows must be an array."
      }
    };
  }

  const hasInvalidShape = cashFlows.some(
    (cashFlow) => !cashFlow || typeof cashFlow !== "object"
  );

  if (hasInvalidShape) {
    return {
      ok: false as const,
      error: {
        code: "INVALID_CASH_FLOWS" as const,
        message: "Cash flows must be objects with amountMinor and occurredAt fields."
      }
    };
  }

  const nonZeroCashFlows = cashFlows.filter((cashFlow) => cashFlow.amountMinor !== 0);

  if (nonZeroCashFlows.length < 2) {
    return {
      ok: false as const,
      error: {
        code: "INSUFFICIENT_CASH_FLOWS" as const,
        message: "At least two non-zero cash flows are required."
      }
    };
  }

  const invalid = nonZeroCashFlows.find(
    (cashFlow) => !Number.isFinite(cashFlow.amountMinor) || !Number.isInteger(cashFlow.amountMinor)
      || !isValidDate(cashFlow.occurredAt)
  );

  if (invalid) {
    return {
      ok: false as const,
      error: {
        code: "INVALID_CASH_FLOWS" as const,
        message: "Cash flows must use integer minor-unit amounts and valid dates."
      }
    };
  }

  if (!nonZeroCashFlows.some((cashFlow) => cashFlow.amountMinor < 0)) {
    return {
      ok: false as const,
      error: {
        code: "MISSING_NEGATIVE_CASH_FLOW" as const,
        message: "At least one negative investment cash flow is required."
      }
    };
  }

  if (!nonZeroCashFlows.some((cashFlow) => cashFlow.amountMinor > 0)) {
    return {
      ok: false as const,
      error: {
        code: "MISSING_POSITIVE_CASH_FLOW" as const,
        message: "At least one positive withdrawal or valuation cash flow is required."
      }
    };
  }

  const ordered = [...nonZeroCashFlows].sort(
    (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime()
  );
  const startDate = ordered[0].occurredAt;
  const endDate = ordered.at(-1)?.occurredAt ?? startDate;

  if (startDate.getTime() === endDate.getTime()) {
    return {
      ok: false as const,
      error: {
        code: "IDENTICAL_DATES" as const,
        message: "Cash flows must span at least two distinct dates."
      }
    };
  }

  return {
    ok: true as const,
    cashFlows: ordered.map((cashFlow) => ({
      ...cashFlow,
      yearsSinceStart: (cashFlow.occurredAt.getTime() - startDate.getTime()) / MS_PER_DAY / DAYS_PER_YEAR
    }))
  };
}

function solveWithNewton(
  cashFlows: PreparedCashFlow[],
  initialRate: number,
  maxIterations: number,
  tolerance: number
): SolverResult {
  let rate = initialRate;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const value = calculateNetPresentValue(cashFlows, rate);

    if (Math.abs(value) <= tolerance) {
      return {
        ok: true,
        rate,
        iterations: iteration
      };
    }

    const derivative = calculateNetPresentValueDerivative(cashFlows, rate);

    if (!Number.isFinite(value) || !Number.isFinite(derivative) || derivative === 0) {
      return {
        ok: false,
        iterations: iteration
      };
    }

    const nextRate = rate - value / derivative;

    if (!Number.isFinite(nextRate) || nextRate <= MIN_RATE || nextRate > MAX_RATE) {
      return {
        ok: false,
        iterations: iteration
      };
    }

    if (Math.abs(nextRate - rate) <= RATE_TOLERANCE) {
      const nextValue = calculateNetPresentValue(cashFlows, nextRate);

      if (Math.abs(nextValue) <= tolerance) {
        return {
          ok: true,
          rate: nextRate,
          iterations: iteration
        };
      }

      return {
        ok: false,
        iterations: iteration
      };
    }

    rate = nextRate;
  }

  return {
    ok: false,
    iterations: maxIterations
  };
}

function solveWithBisection(
  cashFlows: PreparedCashFlow[],
  maxIterations: number,
  tolerance: number
): SolverResult {
  const bracket = findBisectionBracket(cashFlows, tolerance);

  if (!bracket) {
    return {
      ok: false,
      iterations: 0
    };
  }

  if (bracket.exactRate !== undefined) {
    return {
      ok: true,
      rate: bracket.exactRate,
      iterations: 0
    };
  }

  let low = bracket.low;
  let high = bracket.high;
  let lowValue = calculateNetPresentValue(cashFlows, low);

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const mid = (low + high) / 2;
    const midValue = calculateNetPresentValue(cashFlows, mid);

    if (Math.abs(midValue) <= tolerance || Math.abs(high - low) <= RATE_TOLERANCE) {
      return {
        ok: true,
        rate: mid,
        iterations: iteration
      };
    }

    if (sameSign(lowValue, midValue)) {
      low = mid;
      lowValue = midValue;
    } else {
      high = mid;
    }
  }

  return {
    ok: false,
    iterations: maxIterations
  };
}

function findBisectionBracket(cashFlows: PreparedCashFlow[], tolerance: number) {
  let previousRate: number | undefined;
  let previousValue: number | undefined;

  for (const rate of BISECTION_CANDIDATES) {
    const value = calculateNetPresentValue(cashFlows, rate);

    if (Math.abs(value) <= tolerance) {
      return {
        exactRate: rate
      };
    }

    if (previousRate !== undefined && previousValue !== undefined && !sameSign(previousValue, value)) {
      return {
        low: previousRate,
        high: rate
      };
    }

    previousRate = rate;
    previousValue = value;
  }

  return undefined;
}

function calculateNetPresentValue(cashFlows: PreparedCashFlow[], rate: number) {
  const base = 1 + rate;

  if (base <= 0) {
    return Number.NaN;
  }

  return cashFlows.reduce(
    (sum, cashFlow) => sum + cashFlow.amountMinor / Math.pow(base, cashFlow.yearsSinceStart),
    0
  );
}

function calculateNetPresentValueDerivative(cashFlows: PreparedCashFlow[], rate: number) {
  const base = 1 + rate;

  if (base <= 0) {
    return Number.NaN;
  }

  return cashFlows.reduce(
    (sum, cashFlow) =>
      sum - (cashFlow.amountMinor * cashFlow.yearsSinceStart) / Math.pow(base, cashFlow.yearsSinceStart + 1),
    0
  );
}

function success(
  rate: number,
  iterations: number,
  method: Exclude<XirrCalculationMethod, "NONE">
): XirrSuccessResult {
  return {
    ok: true,
    rate,
    xirrPercent: roundReturnPercent(rate * 100),
    iterations,
    converged: true,
    method
  };
}

function failure(
  error: XirrError,
  iterations: number,
  method: XirrCalculationMethod
): XirrFailureResult {
  return {
    ok: false,
    rate: 0,
    xirrPercent: 0,
    iterations,
    converged: false,
    method,
    error
  };
}

function sameSign(left: number, right: number) {
  return (left < 0 && right < 0) || (left > 0 && right > 0);
}

function isValidDate(date: Date | undefined): date is Date {
  return date instanceof Date && Number.isFinite(date.getTime());
}

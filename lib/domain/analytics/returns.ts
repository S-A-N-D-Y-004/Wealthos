import { percent } from "@/lib/domain/money";

export type ReturnInput = {
  investedAmountMinor: number;
  currentValueMinor: number;
};

export type AnalyticsTimeRangeKind =
  | "SINCE_INCEPTION"
  | "ONE_MONTH"
  | "THREE_MONTHS"
  | "SIX_MONTHS"
  | "ONE_YEAR"
  | "CUSTOM";

export type AnalyticsTimeRange =
  | { kind: "SINCE_INCEPTION"; endDate?: Date }
  | { kind: "ONE_MONTH"; endDate?: Date }
  | { kind: "THREE_MONTHS"; endDate?: Date }
  | { kind: "SIX_MONTHS"; endDate?: Date }
  | { kind: "ONE_YEAR"; endDate?: Date }
  | { kind: "CUSTOM"; startDate: Date; endDate: Date };

export type ResolvedAnalyticsTimeRange = {
  kind: AnalyticsTimeRangeKind;
  startDate?: Date;
  endDate: Date;
};

const MONTHS_BY_RANGE: Partial<Record<AnalyticsTimeRangeKind, number>> = {
  ONE_MONTH: 1,
  THREE_MONTHS: 3,
  SIX_MONTHS: 6,
  ONE_YEAR: 12
};

export function calculateAbsoluteReturn(input: ReturnInput) {
  return input.currentValueMinor - input.investedAmountMinor;
}

export function calculateAbsoluteReturnPercent(input: ReturnInput) {
  return roundReturnPercent(percent(calculateAbsoluteReturn(input), input.investedAmountMinor));
}

export function resolveAnalyticsTimeRange(
  range: AnalyticsTimeRange,
  asOf = new Date()
): ResolvedAnalyticsTimeRange {
  if (range.kind === "CUSTOM") {
    return {
      kind: range.kind,
      startDate: range.startDate,
      endDate: range.endDate
    };
  }

  const endDate = range.endDate ?? asOf;
  const months = MONTHS_BY_RANGE[range.kind];

  return {
    kind: range.kind,
    startDate: months ? addUtcMonths(endDate, -months) : undefined,
    endDate
  };
}

export function roundReturnPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 10) / 10;
}

function addUtcMonths(date: Date, deltaMonths: number) {
  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() + deltaMonths;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths - year * 12;
  const day = Math.min(date.getUTCDate(), daysInUtcMonth(year, month));

  return new Date(Date.UTC(
    year,
    month,
    day,
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  ));
}

function daysInUtcMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

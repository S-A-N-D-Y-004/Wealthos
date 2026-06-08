export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP" | string;

export type Money = {
  amountMinor: number;
  currency: CurrencyCode;
};

const DEFAULT_LOCALE_BY_CURRENCY: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "en-EU",
  GBP: "en-GB"
};

export function minorToMajor(amountMinor: number) {
  return amountMinor / 100;
}

export function majorToMinor(amountMajor: number) {
  return Math.round(amountMajor * 100);
}

export function money(amountMinor: number, currency: CurrencyCode = "INR"): Money {
  return { amountMinor, currency };
}

export function addMoney(values: Money[], currency = values[0]?.currency ?? "INR"): Money {
  assertSameCurrency(values, currency);
  return money(values.reduce((sum, item) => sum + item.amountMinor, 0), currency);
}

export function subtractMoney(left: Money, right: Money): Money {
  assertSameCurrency([left, right], left.currency);
  return money(left.amountMinor - right.amountMinor, left.currency);
}

export function multiplyMoney(value: Money, factor: number): Money {
  return money(Math.round(value.amountMinor * factor), value.currency);
}

export function percent(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatMoney(value: Money, options?: Intl.NumberFormatOptions) {
  const locale = DEFAULT_LOCALE_BY_CURRENCY[value.currency] ?? "en-US";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
    maximumFractionDigits: 0,
    ...options
  }).format(minorToMajor(value.amountMinor));
}

export function formatCompactMoney(value: Money) {
  const abs = Math.abs(value.amountMinor);
  const major = minorToMajor(value.amountMinor);

  if (value.currency === "INR" && abs >= 100_00_00_000) {
    return `₹${(major / 1_00_00_000).toFixed(1)}Cr`;
  }

  if (value.currency === "INR" && abs >= 100_00_000) {
    return `₹${(major / 1_00_000).toFixed(1)}L`;
  }

  return formatMoney(value);
}

function assertSameCurrency(values: Money[], currency: CurrencyCode) {
  const mismatch = values.find((item) => item.currency !== currency);

  if (mismatch) {
    throw new Error(`Currency mismatch: expected ${currency}, received ${mismatch.currency}`);
  }
}


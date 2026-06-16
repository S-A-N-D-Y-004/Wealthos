import { createHash } from "crypto";
import type { LedgerTransactionType } from "@/lib/domain/ledger";
import { getBrokerDefinition, type ImportSource } from "@/lib/imports/broker-registry";
import { hashDuplicateKey, parseCsv } from "@/lib/imports/csv";

export type NormalizedAssetCategoryKind =
  | "EQUITY"
  | "DEBT"
  | "CASH"
  | "GOLD"
  | "CRYPTO"
  | "REAL_ESTATE"
  | "ALTERNATIVE"
  | "INSURANCE"
  | "OTHER";

export type NormalizedAssetType =
  | "STOCK"
  | "ETF"
  | "MUTUAL_FUND"
  | "CRYPTO"
  | "GOLD"
  | "CASH"
  | "FIXED_DEPOSIT"
  | "BOND"
  | "REAL_ESTATE"
  | "OTHER";

export type NormalizedAssetReference = {
  name: string;
  symbol?: string;
  isin?: string;
  exchange?: string;
  type: NormalizedAssetType;
  categoryKind: NormalizedAssetCategoryKind;
  categoryName: string;
  currency: string;
  metadata?: Record<string, string>;
};

export type NormalizedLedgerTransaction = {
  source: ImportSource;
  sourceRowNumber: number;
  type: LedgerTransactionType;
  tradeDate: Date;
  settlementDate?: Date;
  asset?: NormalizedAssetReference;
  quantity?: number;
  priceMinor?: number;
  amountMinor: number;
  feesMinor: number;
  taxesMinor: number;
  currency: string;
  externalReference?: string;
  idempotencyKey: string;
  metadata: {
    source: ImportSource;
    sourceRowNumber: number;
    mapperVersion: 1;
    rawRow: Record<string, string>;
  };
};

export type CsvLedgerConversionError = {
  row: number;
  message: string;
};

export type CsvLedgerConversionResult = {
  source: ImportSource;
  detectedRows: number;
  validRows: number;
  duplicateRows: number;
  rejectedRows: number;
  transactions: NormalizedLedgerTransaction[];
  errors: CsvLedgerConversionError[];
};

type MapperContext = {
  source: ImportSource;
  rowNumber: number;
  defaultCurrency: string;
};

type BaseTransactionInput = Omit<
  NormalizedLedgerTransaction,
  "source" | "sourceRowNumber" | "idempotencyKey" | "metadata" | "feesMinor" | "taxesMinor" | "currency"
> &
  Partial<Pick<NormalizedLedgerTransaction, "feesMinor" | "taxesMinor" | "currency">>;

export function convertCsvToLedgerTransactions(input: {
  source: ImportSource;
  csv: string;
  defaultCurrency?: string;
}): CsvLedgerConversionResult {
  const defaultCurrency = input.defaultCurrency ?? "INR";
  const definition = getBrokerDefinition(input.source);
  const parsed = parseCsv(input.csv);
  const errors: CsvLedgerConversionError[] = [];
  const transactions: NormalizedLedgerTransaction[] = [];
  const seenRows = new Set<string>();
  let duplicateRows = 0;

  for (const requiredColumn of definition.requiredColumns) {
    if (!parsed.headers.includes(requiredColumn)) {
      errors.push({ row: 0, message: `Missing required column: ${requiredColumn}` });
    }
  }

  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const missing = definition.requiredColumns.filter((column) => !row[column]);

    if (missing.length > 0) {
      errors.push({ row: rowNumber, message: `Missing required values: ${missing.join(", ")}` });
      return;
    }

    const duplicateKey = hashDuplicateKey(row, definition.duplicateKeyColumns);

    if (seenRows.has(duplicateKey)) {
      duplicateRows += 1;
      errors.push({ row: rowNumber, message: "Potential duplicate transaction detected" });
      return;
    }

    seenRows.add(duplicateKey);

    try {
      transactions.push(
        mapBrokerCsvRowToLedgerTransaction(input.source, row, {
          source: input.source,
          rowNumber,
          defaultCurrency
        })
      );
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : "Unable to map CSV row to ledger transaction."
      });
    }
  });

  return {
    source: input.source,
    detectedRows: parsed.rows.length,
    validRows: transactions.length,
    duplicateRows,
    rejectedRows: Math.max(parsed.rows.length - transactions.length - duplicateRows, 0),
    transactions,
    errors
  };
}

export function mapBrokerCsvRowToLedgerTransaction(
  source: ImportSource,
  row: Record<string, string>,
  context: MapperContext
): NormalizedLedgerTransaction {
  switch (source) {
    case "ANGEL_ONE":
      return withIdempotency(mapAngelOneRow(row, context));
    case "COINDCX":
      return withIdempotency(mapCoinDcxRow(row, context));
    case "ZERODHA_KITE":
      return withIdempotency(mapZerodhaKiteRow(row, context));
    case "PAYTM_MONEY":
      return withIdempotency(mapPaytmMoneyRow(row, context));
    case "PHONEPE":
      return withIdempotency(mapPhonePeGoldRow(row, context));
    case "ICICI_PRUDENTIAL":
      return withIdempotency(mapIciciPrudentialRow(row, context));
  }
}

export function createTransactionIdempotencyKey(transaction: Omit<NormalizedLedgerTransaction, "idempotencyKey">) {
  const assetKey = transaction.asset
    ? [
        transaction.asset.isin ?? "",
        transaction.asset.symbol ?? "",
        transaction.asset.name,
        transaction.asset.type,
        transaction.asset.currency
      ].join(":")
    : "cash";

  const payload = [
    transaction.source,
    transaction.type,
    transaction.tradeDate.toISOString(),
    transaction.settlementDate?.toISOString() ?? "",
    assetKey,
    transaction.quantity?.toString() ?? "",
    transaction.priceMinor?.toString() ?? "",
    transaction.amountMinor.toString(),
    transaction.feesMinor.toString(),
    transaction.taxesMinor.toString(),
    transaction.currency,
    transaction.externalReference ?? ""
  ].join("|");

  return `${transaction.source}:${createHash("sha256").update(payload).digest("hex")}`;
}

function mapAngelOneRow(row: Record<string, string>, context: MapperContext) {
  const transactionType = mapTransactionType(row.transaction_type, context.source);
  const quantity = parseOptionalQuantity(row.units);
  const amountMinor = positiveMinor(row.amount);
  const priceMinor = row.nav ? positiveMinor(row.nav) : priceFromAmountAndQuantity(amountMinor, quantity);

  return baseTransaction(row, context, {
    type: transactionType,
    tradeDate: parseDate(row.date),
    asset: mutualFundAsset(row.scheme, row.isin, context.defaultCurrency, {
      folio: row.folio
    }),
    quantity: quantityForType(transactionType, quantity),
    priceMinor: priceForType(transactionType, priceMinor),
    amountMinor,
    externalReference: compactParts([row.folio, row.isin, row.scheme, row.date])
  });
}

function mapCoinDcxRow(row: Record<string, string>, context: MapperContext) {
  const market = parseMarket(row.market, context.defaultCurrency);
  const transactionType = mapTransactionType(row.side, context.source);
  const quantity = parseOptionalQuantity(row.quantity);
  const amountMinor = positiveMinor(row.total);
  const priceMinor = row.price ? positiveMinor(row.price) : priceFromAmountAndQuantity(amountMinor, quantity);

  return baseTransaction(row, context, {
    type: transactionType,
    tradeDate: parseDate(row.date),
    asset: {
      name: market.base,
      symbol: market.base,
      type: "CRYPTO",
      categoryKind: "CRYPTO",
      categoryName: "Crypto",
      currency: market.quote,
      metadata: {
        market: row.market
      }
    },
    quantity: quantityForType(transactionType, quantity),
    priceMinor: priceForType(transactionType, priceMinor),
    amountMinor,
    feesMinor: positiveMinor(row.fee),
    currency: market.quote,
    externalReference: row.trade_id || row.order_id || undefined
  });
}

function mapZerodhaKiteRow(row: Record<string, string>, context: MapperContext) {
  const transactionType = mapTransactionType(row.trade_type, context.source);
  const quantity = parseRequiredQuantity(row.quantity);
  const priceMinor = positiveMinor(row.price);
  const amountMinor = multiplyDecimalToMinor(row.quantity, row.price);

  return baseTransaction(row, context, {
    type: transactionType,
    tradeDate: parseDate(row.trade_date),
    asset: {
      name: row.symbol.trim(),
      symbol: normalizeSymbol(row.symbol),
      isin: optionalText(row.isin),
      exchange: optionalText(row.exchange),
      type: "STOCK",
      categoryKind: "EQUITY",
      categoryName: "Equity",
      currency: context.defaultCurrency
    },
    quantity: quantityForType(transactionType, quantity),
    priceMinor: priceForType(transactionType, priceMinor),
    amountMinor,
    feesMinor: positiveMinor(row.charges),
    externalReference: compactParts([row.trade_date, row.exchange, row.isin, row.symbol, row.trade_type])
  });
}

function mapPaytmMoneyRow(row: Record<string, string>, context: MapperContext) {
  const transactionType = mapTransactionType(row.type, context.source);
  const quantity = parseOptionalQuantity(row.quantity);
  const amountMinor = positiveMinor(row.amount);
  const priceMinor = row.price ? positiveMinor(row.price) : priceFromAmountAndQuantity(amountMinor, quantity);

  return baseTransaction(row, context, {
    type: transactionType,
    tradeDate: parseDate(row.date),
    asset: mutualFundAsset(row.instrument, row.isin, context.defaultCurrency, {
      folio: row.folio
    }),
    quantity: quantityForType(transactionType, quantity),
    priceMinor: priceForType(transactionType, priceMinor),
    amountMinor,
    externalReference: compactParts([row.folio, row.isin, row.instrument, row.date, row.type])
  });
}

function mapPhonePeGoldRow(row: Record<string, string>, context: MapperContext) {
  const transactionType = mapTransactionType(row.transaction_type, context.source);
  const quantity = parseRequiredQuantity(row.grams);
  const amountMinor = positiveMinor(row.amount);
  const priceMinor = row.price_per_gram
    ? positiveMinor(row.price_per_gram)
    : priceFromAmountAndQuantity(amountMinor, quantity);

  return baseTransaction(row, context, {
    type: transactionType,
    tradeDate: parseDate(row.date),
    asset: {
      name: "Digital Gold",
      symbol: "GOLD",
      type: "GOLD",
      categoryKind: "GOLD",
      categoryName: "Gold",
      currency: context.defaultCurrency
    },
    quantity: quantityForType(transactionType, quantity),
    priceMinor: priceForType(transactionType, priceMinor),
    amountMinor,
    taxesMinor: positiveMinor(row.gst),
    externalReference: row.invoice_id || undefined
  });
}

function mapIciciPrudentialRow(row: Record<string, string>, context: MapperContext) {
  const transactionType = mapTransactionType(row.transaction_type || "BUY", context.source);
  const quantity = parseOptionalQuantity(row.units);
  const amountMinor = positiveMinor(row.amount);
  const priceMinor = row.nav ? positiveMinor(row.nav) : priceFromAmountAndQuantity(amountMinor, quantity);

  return baseTransaction(row, context, {
    type: transactionType,
    tradeDate: parseDate(row.date),
    asset: {
      name: row.fund.trim(),
      symbol: normalizeSymbol(row.fund),
      type: "MUTUAL_FUND",
      categoryKind: "INSURANCE",
      categoryName: "Insurance",
      currency: context.defaultCurrency,
      metadata: {
        policyOrFolio: row.policy_or_folio
      }
    },
    quantity: quantityForType(transactionType, quantity),
    priceMinor: priceForType(transactionType, priceMinor),
    amountMinor,
    externalReference: compactParts([row.policy_or_folio, row.fund, row.date, row.transaction_type])
  });
}

function baseTransaction(
  rawRow: Record<string, string>,
  context: MapperContext,
  transaction: BaseTransactionInput
): Omit<NormalizedLedgerTransaction, "idempotencyKey"> {
  return {
    source: context.source,
    sourceRowNumber: context.rowNumber,
    type: transaction.type,
    tradeDate: transaction.tradeDate,
    settlementDate: transaction.settlementDate,
    asset: transaction.asset,
    quantity: transaction.quantity,
    priceMinor: transaction.priceMinor,
    amountMinor: transaction.amountMinor,
    feesMinor: transaction.feesMinor ?? 0,
    taxesMinor: transaction.taxesMinor ?? 0,
    currency: transaction.currency ?? context.defaultCurrency,
    externalReference: transaction.externalReference,
    metadata: {
      source: context.source,
      sourceRowNumber: context.rowNumber,
      mapperVersion: 1,
      rawRow
    }
  };
}

function withIdempotency(transaction: Omit<NormalizedLedgerTransaction, "idempotencyKey">): NormalizedLedgerTransaction {
  return {
    ...transaction,
    idempotencyKey: createTransactionIdempotencyKey(transaction)
  };
}

function mutualFundAsset(
  name: string,
  isin: string | undefined,
  currency: string,
  metadata?: Record<string, string>
): NormalizedAssetReference {
  return {
    name: name.trim(),
    symbol: normalizeSymbol(name),
    isin: optionalText(isin),
    type: "MUTUAL_FUND",
    categoryKind: "EQUITY",
    categoryName: "Equity",
    currency,
    metadata: compactRecord(metadata)
  };
}

function mapTransactionType(value: string | undefined, source: ImportSource): LedgerTransactionType {
  const normalized = normalizeType(value);

  if (["buy", "b", "purchase", "purchased", "sip", "subscription", "allotment", "premium", "allocation"].includes(normalized)) {
    return "BUY";
  }

  if (["sell", "s", "sale", "sold", "redemption", "redeem"].includes(normalized)) {
    return "SELL";
  }

  if (["dividend", "dividend_payout", "dividend_reinvestment"].includes(normalized)) {
    return "DIVIDEND";
  }

  if (["interest", "int"].includes(normalized)) {
    return "INTEREST";
  }

  if (["deposit", "transfer_in", "switch_in", "in"].includes(normalized)) {
    return source === "COINDCX" ? "TRANSFER_IN" : "BUY";
  }

  if (["withdrawal", "withdraw", "transfer_out", "switch_out", "out"].includes(normalized)) {
    return source === "COINDCX" ? "TRANSFER_OUT" : "SELL";
  }

  if (["fee", "fees", "charge", "charges", "brokerage"].includes(normalized)) {
    return "FEE";
  }

  if (["tax", "tds", "gst"].includes(normalized)) {
    return "TAX";
  }

  if (["bonus"].includes(normalized)) {
    return "BONUS";
  }

  if (["split", "stock_split"].includes(normalized)) {
    return "SPLIT";
  }

  if (["adjustment", "adjust"].includes(normalized)) {
    return "ADJUSTMENT";
  }

  throw new Error(`Unsupported transaction type: ${value ?? ""}`);
}

function quantityForType(type: LedgerTransactionType, quantity: number | undefined) {
  if (type === "BUY" || type === "SELL" || type === "BONUS" || type === "SPLIT") {
    if (quantity === undefined || quantity <= 0) {
      throw new Error(`${type} transaction quantity must be greater than zero.`);
    }

    return quantity;
  }

  return quantity;
}

function priceForType(type: LedgerTransactionType, priceMinor: number | undefined) {
  if (type === "BUY" || type === "SELL") {
    return priceMinor;
  }

  return undefined;
}

function parseDate(value: string | undefined) {
  const raw = value?.trim();

  if (!raw) {
    throw new Error("Transaction date is required.");
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoMatch) {
    return utcDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const dayFirstMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);

  if (dayFirstMatch) {
    return utcDate(Number(dayFirstMatch[3]), Number(dayFirstMatch[2]), Number(dayFirstMatch[1]));
  }

  throw new Error(`Unsupported date format: ${raw}`);
}

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function positiveMinor(value: string | undefined) {
  if (!value?.trim()) {
    return 0;
  }

  return Math.abs(decimalToMinor(value));
}

function decimalToMinor(value: string) {
  const parsed = parseDecimal(value);
  return Number(roundDiv(parsed.sign * parsed.units * 100n, decimalScale(parsed.scale)));
}

function multiplyDecimalToMinor(left: string, right: string) {
  const leftParsed = parseDecimal(left);
  const rightParsed = parseDecimal(right);
  const numerator = leftParsed.sign * rightParsed.sign * leftParsed.units * rightParsed.units * 100n;
  const denominator = decimalScale(leftParsed.scale + rightParsed.scale);

  return Number(roundDiv(numerator, denominator));
}

function priceFromAmountAndQuantity(amountMinor: number, quantity: number | undefined) {
  if (!quantity || quantity <= 0) {
    return undefined;
  }

  return Math.round(amountMinor / quantity);
}

function parseRequiredQuantity(value: string | undefined) {
  const quantity = parseOptionalQuantity(value);

  if (quantity === undefined || quantity <= 0) {
    throw new Error("Transaction quantity must be greater than zero.");
  }

  return quantity;
}

function parseOptionalQuantity(value: string | undefined) {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = parseDecimal(value);
  return Number(parsed.sign * parsed.units) / 10 ** parsed.scale;
}

function parseDecimal(value: string) {
  const trimmed = value.trim();
  const parenthesesNegative = trimmed.startsWith("(") && trimmed.endsWith(")");
  const cleaned = trimmed
    .replace(/[(),]/g, "")
    .replace(/[^\d.-]/g, "")
    .trim();
  const negative = parenthesesNegative || cleaned.startsWith("-");
  const normalized = cleaned.replace(/-/g, "");
  const [whole = "0", fraction = ""] = normalized.split(".");
  const digits = `${whole || "0"}${fraction}`.replace(/^0+(?=\d)/, "") || "0";

  return {
    sign: negative ? -1n : 1n,
    units: BigInt(digits),
    scale: fraction.length
  };
}

function decimalScale(scale: number) {
  return 10n ** BigInt(scale);
}

function roundDiv(numerator: bigint, denominator: bigint) {
  const sign = numerator < 0n ? -1n : 1n;
  const abs = numerator < 0n ? -numerator : numerator;

  return sign * ((abs + denominator / 2n) / denominator);
}

function parseMarket(market: string, defaultCurrency: string) {
  const normalized = market.trim().toUpperCase().replace(/[-_]/g, "/");

  if (normalized.includes("/")) {
    const [base, quote = defaultCurrency] = normalized.split("/");
    return { base, quote };
  }

  const knownQuotes = ["USDT", "INR", "USD", "BTC", "ETH"];
  const quote = knownQuotes.find((candidate) => normalized.endsWith(candidate)) ?? defaultCurrency;
  const base = normalized.endsWith(quote) ? normalized.slice(0, -quote.length) : normalized;

  return {
    base: base || normalized,
    quote
  };
}

function normalizeType(value: string | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeSymbol(value: string | undefined) {
  const symbol = value
    ?.trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return symbol || undefined;
}

function optionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function compactParts(parts: Array<string | undefined>) {
  const compacted = parts.map(optionalText).filter(Boolean);
  return compacted.length > 0 ? compacted.join("|") : undefined;
}

function compactRecord(record: Record<string, string> | undefined) {
  if (!record) {
    return undefined;
  }

  return Object.fromEntries(Object.entries(record).filter(([, value]) => optionalText(value)));
}

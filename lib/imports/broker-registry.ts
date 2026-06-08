import { z } from "zod";

export const importSourceSchema = z.enum([
  "ANGEL_ONE",
  "COINDCX",
  "ZERODHA_KITE",
  "PAYTM_MONEY",
  "PHONEPE",
  "ICICI_PRUDENTIAL"
]);

export type ImportSource = z.infer<typeof importSourceSchema>;

export type BrokerImportDefinition = {
  source: ImportSource;
  displayName: string;
  supportedModes: Array<"csv" | "api">;
  requiredColumns: string[];
  optionalColumns: string[];
  duplicateKeyColumns: string[];
};

export const brokerImportRegistry: Record<ImportSource, BrokerImportDefinition> = {
  ANGEL_ONE: {
    source: "ANGEL_ONE",
    displayName: "Angel One",
    supportedModes: ["csv"],
    requiredColumns: ["date", "scheme", "transaction_type", "amount"],
    optionalColumns: ["folio", "nav", "units", "isin"],
    duplicateKeyColumns: ["date", "scheme", "transaction_type", "amount", "units"]
  },
  COINDCX: {
    source: "COINDCX",
    displayName: "CoinDCX",
    supportedModes: ["csv"],
    requiredColumns: ["date", "market", "side", "quantity", "price", "total"],
    optionalColumns: ["fee", "order_id", "trade_id"],
    duplicateKeyColumns: ["date", "market", "side", "quantity", "price", "total"]
  },
  ZERODHA_KITE: {
    source: "ZERODHA_KITE",
    displayName: "Zerodha Kite",
    supportedModes: ["csv"],
    requiredColumns: ["trade_date", "symbol", "trade_type", "quantity", "price"],
    optionalColumns: ["exchange", "isin", "charges"],
    duplicateKeyColumns: ["trade_date", "symbol", "trade_type", "quantity", "price"]
  },
  PAYTM_MONEY: {
    source: "PAYTM_MONEY",
    displayName: "Paytm Money",
    supportedModes: ["csv"],
    requiredColumns: ["date", "instrument", "type", "amount"],
    optionalColumns: ["quantity", "price", "folio", "isin"],
    duplicateKeyColumns: ["date", "instrument", "type", "amount"]
  },
  PHONEPE: {
    source: "PHONEPE",
    displayName: "PhonePe Gold",
    supportedModes: ["csv"],
    requiredColumns: ["date", "transaction_type", "grams", "amount"],
    optionalColumns: ["invoice_id", "price_per_gram", "gst"],
    duplicateKeyColumns: ["date", "transaction_type", "grams", "amount"]
  },
  ICICI_PRUDENTIAL: {
    source: "ICICI_PRUDENTIAL",
    displayName: "ICICI Prudential i-Invest",
    supportedModes: ["csv"],
    requiredColumns: ["date", "policy_or_folio", "fund", "amount"],
    optionalColumns: ["units", "nav", "transaction_type"],
    duplicateKeyColumns: ["date", "policy_or_folio", "fund", "amount"]
  }
};

export function getBrokerDefinition(source: ImportSource) {
  return brokerImportRegistry[source];
}


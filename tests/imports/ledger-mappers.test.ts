import { describe, expect, it } from "vitest";
import {
  convertCsvToLedgerTransactions,
  mapBrokerCsvRowToLedgerTransaction
} from "@/lib/imports/ledger-mappers";
import type { ImportSource } from "@/lib/imports/broker-registry";

describe("CSV ledger mappers", () => {
  it.each([
    {
      source: "ANGEL_ONE",
      csv: [
        "date,scheme,transaction_type,amount,folio,nav,units,isin",
        "2026-01-05,Flexi Cap Fund,SIP,1000.50,FOLIO1,10.50,95.285714,INF123"
      ].join("\n"),
      expected: {
        type: "BUY",
        amountMinor: 100050,
        priceMinor: 1050,
        quantity: 95.285714,
        assetType: "MUTUAL_FUND",
        assetName: "Flexi Cap Fund",
        currency: "INR"
      }
    },
    {
      source: "COINDCX",
      csv: [
        "date,market,side,quantity,price,total,fee,order_id,trade_id",
        "2026-01-06,BTC/INR,buy,0.02,100,2,0.10,OID1,TID1"
      ].join("\n"),
      expected: {
        type: "BUY",
        amountMinor: 200,
        priceMinor: 10000,
        quantity: 0.02,
        assetType: "CRYPTO",
        assetName: "BTC",
        currency: "INR"
      }
    },
    {
      source: "ZERODHA_KITE",
      csv: [
        "trade_date,symbol,trade_type,quantity,price,exchange,isin,charges",
        "2026-01-07,NIFTYBEES,BUY,10,250.25,NSE,INF204KB14I2,12.50"
      ].join("\n"),
      expected: {
        type: "BUY",
        amountMinor: 250250,
        priceMinor: 25025,
        quantity: 10,
        assetType: "STOCK",
        assetName: "NIFTYBEES",
        currency: "INR"
      }
    },
    {
      source: "PAYTM_MONEY",
      csv: [
        "date,instrument,type,amount,quantity,price,folio,isin",
        "2026-01-08,Index Fund,redemption,1500,10,150,FOLIO2,INF456"
      ].join("\n"),
      expected: {
        type: "SELL",
        amountMinor: 150000,
        priceMinor: 15000,
        quantity: 10,
        assetType: "MUTUAL_FUND",
        assetName: "Index Fund",
        currency: "INR"
      }
    },
    {
      source: "PHONEPE",
      csv: [
        "date,transaction_type,grams,amount,invoice_id,price_per_gram,gst",
        "2026-01-09,buy,2.5,15000,INV1,6000,450"
      ].join("\n"),
      expected: {
        type: "BUY",
        amountMinor: 1500000,
        priceMinor: 600000,
        quantity: 2.5,
        assetType: "GOLD",
        assetName: "Digital Gold",
        currency: "INR"
      }
    },
    {
      source: "ICICI_PRUDENTIAL",
      csv: [
        "date,policy_or_folio,fund,amount,units,nav,transaction_type",
        "2026-01-10,POL1,Retirement Balanced Fund,2000,20,100,"
      ].join("\n"),
      expected: {
        type: "BUY",
        amountMinor: 200000,
        priceMinor: 10000,
        quantity: 20,
        assetType: "MUTUAL_FUND",
        assetName: "Retirement Balanced Fund",
        currency: "INR"
      }
    }
  ] satisfies Array<{
    source: ImportSource;
    csv: string;
    expected: {
      type: string;
      amountMinor: number;
      priceMinor: number;
      quantity: number;
      assetType: string;
      assetName: string;
      currency: string;
    };
  }>)("maps $source CSV rows into normalized ledger transactions", ({ source, csv, expected }) => {
    const result = convertCsvToLedgerTransactions({ source, csv });

    expect(result.errors).toEqual([]);
    expect(result.detectedRows).toBe(1);
    expect(result.validRows).toBe(1);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({
      source,
      type: expected.type,
      amountMinor: expected.amountMinor,
      priceMinor: expected.priceMinor,
      quantity: expected.quantity,
      currency: expected.currency,
      asset: {
        name: expected.assetName,
        type: expected.assetType
      },
      metadata: {
        source,
        sourceRowNumber: 2,
        mapperVersion: 1
      }
    });
    expect(result.transactions[0].idempotencyKey).toMatch(new RegExp(`^${source}:`));
  });

  it("creates stable idempotency keys for equivalent rows", () => {
    const row = {
      trade_date: "2026-02-01",
      symbol: "NIFTYBEES",
      trade_type: "BUY",
      quantity: "10",
      price: "250",
      exchange: "NSE",
      isin: "INF204KB14I2",
      charges: "10"
    };
    const first = mapBrokerCsvRowToLedgerTransaction("ZERODHA_KITE", row, {
      source: "ZERODHA_KITE",
      rowNumber: 2,
      defaultCurrency: "INR"
    });
    const second = mapBrokerCsvRowToLedgerTransaction("ZERODHA_KITE", row, {
      source: "ZERODHA_KITE",
      rowNumber: 99,
      defaultCurrency: "INR"
    });

    expect(first.idempotencyKey).toBe(second.idempotencyKey);
  });

  it("rejects duplicate CSV rows before persistence", () => {
    const csv = [
      "trade_date,symbol,trade_type,quantity,price",
      "2026-02-01,NIFTYBEES,BUY,10,250",
      "2026-02-01,NIFTYBEES,BUY,10,250"
    ].join("\n");
    const result = convertCsvToLedgerTransactions({ source: "ZERODHA_KITE", csv });

    expect(result.validRows).toBe(1);
    expect(result.duplicateRows).toBe(1);
    expect(result.errors).toEqual([{ row: 3, message: "Potential duplicate transaction detected" }]);
  });

  it("returns deterministic conversion errors for unsupported transaction types", () => {
    const csv = [
      "trade_date,symbol,trade_type,quantity,price",
      "2026-02-01,NIFTYBEES,UNKNOWN,10,250"
    ].join("\n");
    const result = convertCsvToLedgerTransactions({ source: "ZERODHA_KITE", csv });

    expect(result.validRows).toBe(0);
    expect(result.rejectedRows).toBe(1);
    expect(result.errors).toEqual([{ row: 2, message: "Unsupported transaction type: UNKNOWN" }]);
  });
});

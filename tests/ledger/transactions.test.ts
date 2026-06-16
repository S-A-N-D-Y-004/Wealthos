import { describe, expect, it } from "vitest";
import { calculateNetCashFlow, calculateTransactionCost, type LedgerTransaction } from "@/lib/domain/ledger";

const baseTransaction = {
  id: "txn-base",
  accountId: "account-1",
  currency: "INR",
  occurredAt: new Date("2026-01-01T00:00:00.000Z")
} satisfies Pick<LedgerTransaction, "id" | "accountId" | "currency" | "occurredAt">;

describe("ledger transactions", () => {
  it("calculates transaction cost including fees and taxes", () => {
    expect(
      calculateTransactionCost({
        ...baseTransaction,
        type: "BUY",
        assetId: "asset-1",
        quantity: 10,
        priceMinor: 10000,
        amountMinor: 100000,
        feesMinor: 250,
        taxesMinor: 750
      })
    ).toBe(101000);
  });

  it("defaults missing fees and taxes to zero for transaction cost", () => {
    expect(
      calculateTransactionCost({
        ...baseTransaction,
        type: "BUY",
        assetId: "asset-1",
        quantity: 4,
        priceMinor: 5000,
        amountMinor: 20000
      })
    ).toBe(20000);
  });

  it("calculates net cash flow from cash-in and cash-out transaction types", () => {
    const transactions: LedgerTransaction[] = [
      { ...baseTransaction, id: "deposit", type: "DEPOSIT", amountMinor: 100000 },
      { ...baseTransaction, id: "dividend", type: "DIVIDEND", assetId: "asset-1", amountMinor: 5000 },
      { ...baseTransaction, id: "interest", type: "INTEREST", amountMinor: 2500 },
      { ...baseTransaction, id: "sell", type: "SELL", assetId: "asset-1", quantity: 2, amountMinor: 30000 },
      { ...baseTransaction, id: "transfer-in", type: "TRANSFER_IN", amountMinor: 20000 },
      { ...baseTransaction, id: "buy", type: "BUY", assetId: "asset-1", quantity: 5, amountMinor: 40000 },
      { ...baseTransaction, id: "withdrawal", type: "WITHDRAWAL", amountMinor: 10000 },
      { ...baseTransaction, id: "transfer-out", type: "TRANSFER_OUT", amountMinor: 15000 },
      { ...baseTransaction, id: "fee", type: "FEE", amountMinor: 300 },
      { ...baseTransaction, id: "tax", type: "TAX", amountMinor: 700 },
      { ...baseTransaction, id: "bonus", type: "BONUS", assetId: "asset-1", quantity: 1, amountMinor: 0 },
      { ...baseTransaction, id: "split", type: "SPLIT", assetId: "asset-1", quantity: 0, amountMinor: 0 },
      { ...baseTransaction, id: "adjustment", type: "ADJUSTMENT", amountMinor: 999999 }
    ];

    expect(calculateNetCashFlow(transactions)).toBe(91500);
  });
});

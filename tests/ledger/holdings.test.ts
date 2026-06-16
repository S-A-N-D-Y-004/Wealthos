import { describe, expect, it } from "vitest";
import { deriveHoldingFromTransactions, type LedgerTransaction } from "@/lib/domain/ledger";

function ledgerTransaction(input: Partial<LedgerTransaction> & Pick<LedgerTransaction, "id" | "type" | "amountMinor">) {
  return {
    accountId: "account-1",
    assetId: "asset-1",
    currency: "INR",
    occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    ...input
  } satisfies LedgerTransaction;
}

describe("deriveHoldingFromTransactions", () => {
  it("derives quantity and cost basis from BUY transactions", () => {
    const result = deriveHoldingFromTransactions([
      ledgerTransaction({
        id: "buy-1",
        type: "BUY",
        quantity: 10,
        amountMinor: 100000,
        feesMinor: 500,
        taxesMinor: 500
      }),
      ledgerTransaction({
        id: "buy-2",
        type: "BUY",
        quantity: 5,
        amountMinor: 60000
      })
    ]);

    expect(result).toEqual({
      quantity: 15,
      averageCostMinor: 10733,
      costBasisMinor: 161000,
      realizedGainMinor: 0
    });
  });

  it("calculates average cost across multiple buys", () => {
    const result = deriveHoldingFromTransactions([
      ledgerTransaction({ id: "buy-1", type: "BUY", quantity: 3, amountMinor: 30000 }),
      ledgerTransaction({ id: "buy-2", type: "BUY", quantity: 2, amountMinor: 30000 })
    ]);

    expect(result.quantity).toBe(5);
    expect(result.costBasisMinor).toBe(60000);
    expect(result.averageCostMinor).toBe(12000);
  });

  it("reduces quantity and cost basis for SELL transactions using average cost", () => {
    const result = deriveHoldingFromTransactions([
      ledgerTransaction({ id: "buy-1", type: "BUY", quantity: 10, amountMinor: 100000 }),
      ledgerTransaction({
        id: "sell-1",
        type: "SELL",
        quantity: 4,
        amountMinor: 60000,
        occurredAt: new Date("2026-01-02T00:00:00.000Z")
      })
    ]);

    expect(result.quantity).toBe(6);
    expect(result.averageCostMinor).toBe(10000);
    expect(result.costBasisMinor).toBe(60000);
  });

  it("calculates realized gains from SELL proceeds minus sold average cost", () => {
    const result = deriveHoldingFromTransactions([
      ledgerTransaction({ id: "buy-1", type: "BUY", quantity: 10, amountMinor: 100000 }),
      ledgerTransaction({
        id: "sell-1",
        type: "SELL",
        quantity: 4,
        amountMinor: 70000,
        occurredAt: new Date("2026-01-02T00:00:00.000Z")
      })
    ]);

    expect(result.realizedGainMinor).toBe(30000);
  });

  it("sorts transactions by occurrence date before deriving holdings", () => {
    const result = deriveHoldingFromTransactions([
      ledgerTransaction({
        id: "sell-1",
        type: "SELL",
        quantity: 2,
        amountMinor: 30000,
        occurredAt: new Date("2026-01-03T00:00:00.000Z")
      }),
      ledgerTransaction({
        id: "buy-1",
        type: "BUY",
        quantity: 5,
        amountMinor: 50000,
        occurredAt: new Date("2026-01-01T00:00:00.000Z")
      })
    ]);

    expect(result.quantity).toBe(3);
    expect(result.costBasisMinor).toBe(30000);
    expect(result.realizedGainMinor).toBe(10000);
  });

  it("rejects oversell transactions", () => {
    expect(() =>
      deriveHoldingFromTransactions([
        ledgerTransaction({ id: "buy-1", type: "BUY", quantity: 3, amountMinor: 30000 }),
        ledgerTransaction({
          id: "sell-1",
          type: "SELL",
          quantity: 4,
          amountMinor: 50000,
          occurredAt: new Date("2026-01-02T00:00:00.000Z")
        })
      ])
    ).toThrow("SELL transaction quantity exceeds available holding quantity.");
  });
});

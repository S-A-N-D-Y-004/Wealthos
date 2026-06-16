import type { HoldingInput } from "@/lib/domain/models";
import type { LedgerTransaction } from "./transactions";

export type HoldingCalculationResult = {
  quantity: number;
  averageCostMinor: number;
  costBasisMinor: number;
  realizedGainMinor: number;
};

export function deriveHoldingFromTransactions(
  transactions: LedgerTransaction[]
): HoldingCalculationResult {
  const ordered = [...transactions].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()
  );

  let quantity = 0;
  let totalCostMinor = 0;
  let realizedGainMinor = 0;

  for (const transaction of ordered) {
    if (transaction.type === "BUY") {
      const qty = transaction.quantity ?? 0;

      quantity += qty;

      totalCostMinor +=
        transaction.amountMinor +
        (transaction.feesMinor ?? 0) +
        (transaction.taxesMinor ?? 0);
    }

    if (transaction.type === "SELL") {
      const qty = transaction.quantity ?? 0;

      if (qty <= 0) {
        throw new Error("SELL transaction quantity must be greater than zero.");
      }

      if (qty > quantity) {
        throw new Error("SELL transaction quantity exceeds available holding quantity.");
      }

      const averageCost =
        quantity === 0 ? 0 : Math.round(totalCostMinor / quantity);

      const saleValue = transaction.amountMinor;

      const costOfSoldShares = averageCost * qty;

      realizedGainMinor += saleValue - costOfSoldShares;

      quantity -= qty;

      totalCostMinor -= costOfSoldShares;
    }
  }

  const averageCostMinor =
    quantity === 0 ? 0 : Math.round(totalCostMinor / quantity);

  return {
    quantity,
    averageCostMinor,
    costBasisMinor: totalCostMinor,
    realizedGainMinor
  };
}

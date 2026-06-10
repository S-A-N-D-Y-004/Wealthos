export type LedgerTransactionType =
  | "BUY"
  | "SELL"
  | "DIVIDEND"
  | "INTEREST"
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "FEE"
  | "TAX"
  | "BONUS"
  | "SPLIT"
  | "ADJUSTMENT";

export type LedgerTransaction = {
  id: string;
  accountId: string;
  assetId?: string;

  type: LedgerTransactionType;

  quantity?: number;

  priceMinor?: number;

  amountMinor: number;

  feesMinor?: number;

  taxesMinor?: number;

  currency: string;

  occurredAt: Date;
};

export function isAssetTransaction(
  transaction: LedgerTransaction
): boolean {
  return !!transaction.assetId;
}

export function calculateTransactionCost(
  transaction: LedgerTransaction
): number {
  return (
    transaction.amountMinor +
    (transaction.feesMinor ?? 0) +
    (transaction.taxesMinor ?? 0)
  );
}

export function calculateNetCashFlow(
  transactions: LedgerTransaction[]
): number {
  return transactions.reduce((total, transaction) => {
    switch (transaction.type) {
      case "DEPOSIT":
      case "DIVIDEND":
      case "INTEREST":
      case "SELL":
      case "TRANSFER_IN":
        return total + transaction.amountMinor;

      case "BUY":
      case "WITHDRAWAL":
      case "TRANSFER_OUT":
      case "FEE":
      case "TAX":
        return total - transaction.amountMinor;

      default:
        return total;
    }
  }, 0);
}
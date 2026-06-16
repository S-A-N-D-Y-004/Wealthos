import { describe, expect, it } from "vitest";
import { processImportJob } from "@/trigger/jobs/import-processing";
import {
  persistCsvImportToLedger,
  type LedgerImportPrismaClient
} from "@/lib/imports/ledger-persistence";

type TransactionRow = {
  id: string;
  userId: string;
  accountId: string;
  assetId: string | null;
  type: string;
  tradeDate: Date;
  quantity: string | null;
  priceMinor: bigint | null;
  amountMinor: bigint;
  feesMinor: bigint;
  taxesMinor: bigint;
  currency: string;
  idempotencyKey: string;
  importJobId?: string;
};

class FakeLedgerPrisma implements LedgerImportPrismaClient {
  operations: string[] = [];
  transactions: TransactionRow[] = [];
  holdings: unknown[] = [];
  importJobUpdates: unknown[] = [];
  assetCreates: unknown[] = [];
  createManyCalls = 0;

  private assetIdByName = new Map<string, string>();
  private categoryIdByName = new Map<string, string>();

  async $transaction<T>(callback: (tx: LedgerImportPrismaClient) => Promise<T>): Promise<T> {
    this.operations.push("transaction");
    return callback(this);
  }

  importJob = {
    update: async (args: unknown) => {
      this.operations.push("importJob.update");
      this.importJobUpdates.push(args);
      return args;
    }
  };

  assetCategory = {
    upsert: async (args: unknown) => {
      this.operations.push("assetCategory.upsert");
      const name = dataName(args);
      const existing = this.categoryIdByName.get(name);

      if (existing) {
        return { id: existing };
      }

      const id = `category-${this.categoryIdByName.size + 1}`;
      this.categoryIdByName.set(name, id);
      return { id };
    }
  };

  asset = {
    findFirst: async (args: unknown) => {
      this.operations.push("asset.findFirst");
      const name = findNameInWhere(args);
      const id = name ? this.assetIdByName.get(name) : undefined;
      return id ? { id } : null;
    },
    create: async (args: unknown) => {
      this.operations.push("asset.create");
      this.assetCreates.push(args);
      const name = dataName(args);
      const id = `asset-${this.assetIdByName.size + 1}`;
      this.assetIdByName.set(name, id);
      return { id };
    }
  };

  transaction = {
    createMany: async (args: unknown) => {
      this.operations.push("transaction.createMany");
      this.createManyCalls += 1;
      const data = (args as { data: Array<Record<string, unknown>> }).data;
      let count = 0;

      for (const incoming of data) {
        const row = {
          ...incoming,
          assetId: (incoming.assetId as string | undefined) ?? null,
          quantity: (incoming.quantity as string | undefined) ?? null,
          priceMinor: (incoming.priceMinor as bigint | undefined) ?? null
        } as TransactionRow;
        const duplicate = this.transactions.some(
          (transaction) => transaction.userId === row.userId && transaction.idempotencyKey === row.idempotencyKey
        );

        if (!duplicate) {
          this.transactions.push(row);
          count += 1;
        }
      }

      return { count };
    },
    findMany: async (args: unknown) => {
      this.operations.push("transaction.findMany");
      const where = (args as { where: { accountId: string; assetId: string } }).where;
      return this.transactions
        .filter((transaction) => transaction.accountId === where.accountId && transaction.assetId === where.assetId)
        .sort((left, right) => left.tradeDate.getTime() - right.tradeDate.getTime());
    }
  };

  holding = {
    upsert: async (args: unknown) => {
      this.operations.push("holding.upsert");
      this.holdings.push(args);
      return args;
    }
  };
}

describe("CSV ledger persistence", () => {
  it("persists transactions and recomputes holdings after import", async () => {
    const client = new FakeLedgerPrisma();
    const csv = [
      "trade_date,symbol,trade_type,quantity,price,exchange,isin,charges",
      "2026-01-01,NIFTYBEES,BUY,10,100,NSE,INF204KB14I2,0",
      "2026-01-02,NIFTYBEES,SELL,4,150,NSE,INF204KB14I2,0"
    ].join("\n");

    const result = await persistCsvImportToLedger(
      {
        importJobId: "import-1",
        userId: "user-1",
        accountId: "account-1",
        source: "ZERODHA_KITE",
        csv,
        originalFileName: "kite.csv",
        importedAt: new Date("2026-01-03T00:00:00.000Z")
      },
      client
    );

    expect(result).toMatchObject({
      importJobId: "import-1",
      status: "COMPLETED",
      detectedRows: 2,
      validRows: 2,
      duplicateRows: 0,
      rejectedRows: 0,
      createdTransactions: 2,
      errors: []
    });
    expect(client.transactions).toHaveLength(2);
    expect(client.transactions[0].id).toMatch(/^txn_[a-f0-9]{24}$/);
    expect(client.transactions[0]).toMatchObject({
      userId: "user-1",
      accountId: "account-1",
      assetId: "asset-1",
      type: "BUY",
      quantity: "10",
      priceMinor: 10000n,
      amountMinor: 100000n,
      importJobId: "import-1"
    });

    const createIndex = client.operations.indexOf("transaction.createMany");
    const holdingIndex = client.operations.indexOf("holding.upsert");
    expect(createIndex).toBeGreaterThan(-1);
    expect(holdingIndex).toBeGreaterThan(createIndex);
    expect(client.holdings.at(-1)).toMatchObject({
      update: {
        quantity: "6",
        averageCostMinor: 10000n,
        costBasisMinor: 60000n,
        currentPriceMinor: 15000n,
        currentValueMinor: 90000n,
        realizedGainMinor: 20000n,
        unrealizedGainMinor: 30000n,
        sourceMetadata: {
          derivedFrom: "transactions"
        }
      }
    });
  });

  it("prevents duplicate imports using idempotency keys and stable transaction IDs", async () => {
    const client = new FakeLedgerPrisma();
    const csv = [
      "trade_date,symbol,trade_type,quantity,price",
      "2026-01-01,NIFTYBEES,BUY,10,100"
    ].join("\n");

    const first = await persistCsvImportToLedger(
      {
        userId: "user-1",
        accountId: "account-1",
        source: "ZERODHA_KITE",
        csv
      },
      client
    );
    const firstTransactionId = client.transactions[0].id;
    const second = await persistCsvImportToLedger(
      {
        userId: "user-1",
        accountId: "account-1",
        source: "ZERODHA_KITE",
        csv
      },
      client
    );

    expect(first.createdTransactions).toBe(1);
    expect(second.createdTransactions).toBe(0);
    expect(second.duplicateRows).toBe(1);
    expect(client.transactions).toHaveLength(1);
    expect(client.transactions[0].id).toBe(firstTransactionId);
    expect(first.idempotencyKeys).toEqual(second.idempotencyKeys);
  });

  it("does not persist transactions when CSV conversion requires validation", async () => {
    const client = new FakeLedgerPrisma();
    const csv = [
      "trade_date,symbol,trade_type,quantity,price",
      "2026-01-01,NIFTYBEES,BUY,10,100",
      "2026-01-01,NIFTYBEES,BUY,10,100"
    ].join("\n");

    const result = await persistCsvImportToLedger(
      {
        importJobId: "import-duplicate",
        userId: "user-1",
        accountId: "account-1",
        source: "ZERODHA_KITE",
        csv
      },
      client
    );

    expect(result.status).toBe("VALIDATION_REQUIRED");
    expect(result.createdTransactions).toBe(0);
    expect(client.createManyCalls).toBe(0);
    expect(client.transactions).toEqual([]);
    expect(client.importJobUpdates.at(-1)).toMatchObject({
      data: {
        status: "FAILED",
        duplicateRows: 1,
        rejectedRows: 0
      }
    });
  });

  it("wires import processing jobs to ledger persistence", async () => {
    const client = new FakeLedgerPrisma();
    const csv = [
      "date,market,side,quantity,price,total,fee,order_id,trade_id",
      "2026-01-06,BTC/INR,buy,0.02,100,2,0.10,OID1,TID1"
    ].join("\n");

    const result = await processImportJob(
      {
        importJobId: "import-job-1",
        userId: "user-1",
        accountId: "account-crypto",
        source: "COINDCX",
        csv,
        originalFileName: "coindcx.csv"
      },
      client
    );

    expect(result.status).toBe("COMPLETED");
    expect(result.createdTransactions).toBe(1);
    expect(client.transactions[0]).toMatchObject({
      accountId: "account-crypto",
      type: "BUY",
      amountMinor: 200n,
      feesMinor: 10n,
      currency: "INR"
    });
  });
});

function dataName(args: unknown) {
  return (args as { data?: { name?: string }; create?: { name?: string } }).data?.name
    ?? (args as { data?: { name?: string }; create?: { name?: string } }).create?.name
    ?? "unknown";
}

function findNameInWhere(args: unknown) {
  const or = (args as { where?: { OR?: Array<{ name?: string }> } }).where?.OR ?? [];
  return or.find((item) => item.name)?.name;
}

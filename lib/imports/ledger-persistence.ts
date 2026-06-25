import type { LedgerTransaction, LedgerTransactionType } from "@/lib/domain/ledger";
import { createHash } from "crypto";
import { invalidateDashboardProjection } from "@/lib/dashboard/projections";
import { deriveHoldingFromTransactions } from "@/lib/domain/ledger";
import type { ImportSource } from "@/lib/imports/broker-registry";
import {
  convertCsvToLedgerTransactions,
  type NormalizedAssetReference,
  type NormalizedLedgerTransaction
} from "@/lib/imports/ledger-mappers";

export type LedgerImportInput = {
  importJobId?: string;
  userId: string;
  accountId: string;
  source: ImportSource;
  csv: string;
  defaultCurrency?: string;
  originalFileName?: string;
  importedAt?: Date;
};

export type LedgerImportResult = {
  importJobId?: string;
  status: "COMPLETED" | "VALIDATION_REQUIRED";
  detectedRows: number;
  validRows: number;
  duplicateRows: number;
  rejectedRows: number;
  createdTransactions: number;
  errors: Array<{ row: number; message: string }>;
  idempotencyKeys: string[];
};

export type LedgerImportPrismaClient = {
  $transaction?<T>(callback: (tx: LedgerImportPrismaClient) => Promise<T>): Promise<T>;
  importJob?: {
    update(args: unknown): Promise<unknown>;
  };
  assetCategory: {
    upsert(args: unknown): Promise<{ id: string }>;
  };
  asset: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  transaction: {
    createMany(args: unknown): Promise<{ count: number }>;
    findMany(args: unknown): Promise<PersistedLedgerTransaction[]>;
  };
  holding: {
    upsert(args: unknown): Promise<unknown>;
  };
};

type PersistedLedgerTransaction = {
  id: string;
  accountId: string;
  assetId: string | null;
  type: string;
  quantity: unknown | null;
  priceMinor: bigint | number | null;
  amountMinor: bigint | number;
  feesMinor: bigint | number;
  taxesMinor: bigint | number;
  currency: string;
  tradeDate: Date;
};

export async function persistCsvImportToLedger(
  input: LedgerImportInput,
  client: LedgerImportPrismaClient
): Promise<LedgerImportResult> {
  const conversion = convertCsvToLedgerTransactions({
    source: input.source,
    csv: input.csv,
    defaultCurrency: input.defaultCurrency
  });

  if (conversion.errors.length > 0) {
    await updateImportJob(client, input.importJobId, {
      status: "FAILED",
      detectedRows: conversion.detectedRows,
      validRows: conversion.validRows,
      duplicateRows: conversion.duplicateRows,
      rejectedRows: conversion.rejectedRows,
      validationSummary: {
        errors: conversion.errors
      },
      completedAt: input.importedAt ?? new Date()
    });

    return {
      importJobId: input.importJobId,
      status: "VALIDATION_REQUIRED",
      detectedRows: conversion.detectedRows,
      validRows: conversion.validRows,
      duplicateRows: conversion.duplicateRows,
      rejectedRows: conversion.rejectedRows,
      createdTransactions: 0,
      errors: conversion.errors,
      idempotencyKeys: conversion.transactions.map((transaction) => transaction.idempotencyKey)
    };
  }

  const result: LedgerImportResult = await runInTransaction(client, async (tx) => {
    await updateImportJob(tx, input.importJobId, {
      status: "IMPORTING",
      startedAt: input.importedAt ?? new Date()
    });

    const assetIds = await resolveAssets(tx, conversion.transactions);
    const transactionRows = conversion.transactions.map((transaction) =>
      toTransactionCreateRow(input, transaction, assetIds.get(transaction.idempotencyKey))
    );
    const createResult =
      transactionRows.length === 0
        ? { count: 0 }
        : await tx.transaction.createMany({
            data: transactionRows,
            skipDuplicates: true
          });
    const affectedAssetIds = uniqueDefined(Array.from(assetIds.values()));

    await recomputeHoldingsForAssets(tx, input.accountId, affectedAssetIds, input.importedAt ?? new Date());

    const duplicateImports = transactionRows.length - createResult.count;
    const duplicateRows = conversion.duplicateRows + duplicateImports;

    await updateImportJob(tx, input.importJobId, {
      status: "COMPLETED",
      detectedRows: conversion.detectedRows,
      validRows: conversion.validRows,
      duplicateRows,
      rejectedRows: conversion.rejectedRows,
      validationSummary: {
        createdTransactions: createResult.count,
        duplicateImports,
        idempotencyKeys: conversion.transactions.map((transaction) => transaction.idempotencyKey)
      },
      completedAt: input.importedAt ?? new Date()
    });

    return {
      importJobId: input.importJobId,
      status: "COMPLETED",
      detectedRows: conversion.detectedRows,
      validRows: conversion.validRows,
      duplicateRows,
      rejectedRows: conversion.rejectedRows,
      createdTransactions: createResult.count,
      errors: [],
      idempotencyKeys: conversion.transactions.map((transaction) => transaction.idempotencyKey)
    };
  });

  if (result.createdTransactions > 0) {
    invalidateDashboardProjection(input.userId, "csv-import");
  }

  return result;
}

async function resolveAssets(
  client: LedgerImportPrismaClient,
  transactions: NormalizedLedgerTransaction[]
): Promise<Map<string, string | undefined>> {
  const assetIds = new Map<string, string | undefined>();
  const assetCache = new Map<string, string>();

  for (const transaction of transactions) {
    if (!transaction.asset) {
      assetIds.set(transaction.idempotencyKey, undefined);
      continue;
    }

    const cacheKey = assetCacheKey(transaction.asset);
    const cachedAssetId = assetCache.get(cacheKey);

    if (cachedAssetId) {
      assetIds.set(transaction.idempotencyKey, cachedAssetId);
      continue;
    }

    const assetId = await resolveAsset(client, transaction.asset);
    assetCache.set(cacheKey, assetId);
    assetIds.set(transaction.idempotencyKey, assetId);
  }

  return assetIds;
}

async function resolveAsset(client: LedgerImportPrismaClient, asset: NormalizedAssetReference) {
  const existing = await client.asset.findFirst({
    where: {
      deletedAt: null,
      OR: [
        asset.isin ? { isin: asset.isin } : undefined,
        asset.symbol ? { symbol: asset.symbol, currency: asset.currency, type: asset.type } : undefined,
        { name: asset.name, currency: asset.currency, type: asset.type }
      ].filter(Boolean)
    },
    select: {
      id: true
    }
  });

  if (existing) {
    return existing.id;
  }

  const category = await client.assetCategory.upsert({
    where: {
      name: asset.categoryName
    },
    update: {
      kind: asset.categoryKind
    },
    create: {
      name: asset.categoryName,
      kind: asset.categoryKind
    },
    select: {
      id: true
    }
  });

  const created = await client.asset.create({
    data: {
      categoryId: category.id,
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
      isin: asset.isin,
      exchange: asset.exchange,
      currency: asset.currency,
      metadata: asset.metadata
    },
    select: {
      id: true
    }
  });

  return created.id;
}

function toTransactionCreateRow(
  input: LedgerImportInput,
  transaction: NormalizedLedgerTransaction,
  assetId: string | undefined
): Record<string, unknown> {
  return {
    id: createStableTransactionId(input.userId, transaction.idempotencyKey),
    userId: input.userId,
    accountId: input.accountId,
    assetId,
    type: transaction.type,
    tradeDate: transaction.tradeDate,
    settlementDate: transaction.settlementDate,
    quantity: transaction.quantity?.toString(),
    priceMinor: toBigInt(transaction.priceMinor),
    amountMinor: BigInt(transaction.amountMinor),
    feesMinor: BigInt(transaction.feesMinor),
    taxesMinor: BigInt(transaction.taxesMinor),
    currency: transaction.currency,
    externalReference: transaction.externalReference ?? transaction.idempotencyKey,
    importJobId: input.importJobId,
    idempotencyKey: transaction.idempotencyKey,
    metadata: {
      ...transaction.metadata,
      originalFileName: input.originalFileName
    }
  };
}

function createStableTransactionId(userId: string, idempotencyKey: string) {
  const digest = createHash("sha256").update(`${userId}:${idempotencyKey}`).digest("hex").slice(0, 24);
  return `txn_${digest}`;
}

async function recomputeHoldingsForAssets(
  client: LedgerImportPrismaClient,
  accountId: string,
  assetIds: string[],
  valuationAsOf: Date
) {
  for (const assetId of assetIds) {
    const persistedTransactions = await client.transaction.findMany({
      where: {
        accountId,
        assetId,
        deletedAt: null
      },
      orderBy: {
        tradeDate: "asc"
      },
      select: {
        id: true,
        accountId: true,
        assetId: true,
        type: true,
        quantity: true,
        priceMinor: true,
        amountMinor: true,
        feesMinor: true,
        taxesMinor: true,
        currency: true,
        tradeDate: true
      }
    });
    const ledgerTransactions = persistedTransactions.map(toLedgerTransaction);
    const holding = deriveHoldingFromTransactions(ledgerTransactions);
    const latestPriceMinor = latestDefined(ledgerTransactions.map((transaction) => transaction.priceMinor));
    const currentPriceMinor = latestPriceMinor ?? holding.averageCostMinor;
    const currentValueMinor = Math.round(holding.quantity * currentPriceMinor);

    await client.holding.upsert({
      where: {
        accountId_assetId: {
          accountId,
          assetId
        }
      },
      update: {
        quantity: holding.quantity.toString(),
        averageCostMinor: BigInt(holding.averageCostMinor),
        costBasisMinor: BigInt(holding.costBasisMinor),
        currentPriceMinor: BigInt(currentPriceMinor),
        currentValueMinor: BigInt(currentValueMinor),
        realizedGainMinor: BigInt(holding.realizedGainMinor),
        unrealizedGainMinor: BigInt(currentValueMinor - holding.costBasisMinor),
        valuationAsOf,
        sourceMetadata: {
          derivedFrom: "transactions"
        }
      },
      create: {
        accountId,
        assetId,
        quantity: holding.quantity.toString(),
        averageCostMinor: BigInt(holding.averageCostMinor),
        costBasisMinor: BigInt(holding.costBasisMinor),
        currentPriceMinor: BigInt(currentPriceMinor),
        currentValueMinor: BigInt(currentValueMinor),
        realizedGainMinor: BigInt(holding.realizedGainMinor),
        unrealizedGainMinor: BigInt(currentValueMinor - holding.costBasisMinor),
        valuationAsOf,
        sourceMetadata: {
          derivedFrom: "transactions"
        }
      }
    });
  }
}

function toLedgerTransaction(transaction: PersistedLedgerTransaction): LedgerTransaction {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    assetId: transaction.assetId ?? undefined,
    type: transaction.type as LedgerTransactionType,
    quantity: toOptionalNumber(transaction.quantity),
    priceMinor: toOptionalNumber(transaction.priceMinor),
    amountMinor: toNumber(transaction.amountMinor),
    feesMinor: toNumber(transaction.feesMinor),
    taxesMinor: toNumber(transaction.taxesMinor),
    currency: transaction.currency,
    occurredAt: transaction.tradeDate
  };
}

function assetCacheKey(asset: NormalizedAssetReference) {
  return [asset.isin ?? "", asset.symbol ?? "", asset.name, asset.type, asset.currency].join("|");
}

function toBigInt(value: number | undefined) {
  return value === undefined ? undefined : BigInt(value);
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return Number(String(value));
}

function toOptionalNumber(value: unknown) {
  return value === null || value === undefined ? undefined : toNumber(value);
}

function latestDefined<T>(values: Array<T | undefined>) {
  return values.filter((value): value is T => value !== undefined).at(-1);
}

function uniqueDefined(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function runInTransaction<T>(
  client: LedgerImportPrismaClient,
  callback: (tx: LedgerImportPrismaClient) => Promise<T>
) {
  if (client.$transaction) {
    return client.$transaction(callback);
  }

  return callback(client);
}

async function updateImportJob(
  client: LedgerImportPrismaClient,
  importJobId: string | undefined,
  data: Record<string, unknown>
) {
  if (!importJobId || !client.importJob) {
    return;
  }

  await client.importJob.update({
    where: {
      id: importJobId
    },
    data
  });
}

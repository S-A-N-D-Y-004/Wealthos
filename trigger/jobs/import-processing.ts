import { getBrokerDefinition, type ImportSource } from "@/lib/imports/broker-registry";
import { prisma } from "@/lib/db";
import {
  persistCsvImportToLedger,
  type LedgerImportPrismaClient
} from "@/lib/imports/ledger-persistence";

export type ImportProcessingJobInput = {
  importJobId: string;
  userId: string;
  accountId: string;
  source: ImportSource;
  csv: string;
  originalFileName?: string;
};

export async function processImportJob(
  input: ImportProcessingJobInput,
  client: LedgerImportPrismaClient = prisma as unknown as LedgerImportPrismaClient
) {
  const definition = getBrokerDefinition(input.source);

  return persistCsvImportToLedger(
    {
      importJobId: input.importJobId,
      userId: input.userId,
      accountId: input.accountId,
      source: definition.source,
      csv: input.csv,
      originalFileName: input.originalFileName
    },
    client
  );
}

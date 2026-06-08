import { previewImport } from "@/lib/imports/csv";
import { getBrokerDefinition, type ImportSource } from "@/lib/imports/broker-registry";

export type ImportProcessingJobInput = {
  importJobId: string;
  source: ImportSource;
  csv: string;
};

export async function processImportJob(input: ImportProcessingJobInput) {
  const definition = getBrokerDefinition(input.source);
  const preview = previewImport(input.csv, definition);

  return {
    importJobId: input.importJobId,
    status: preview.errors.length > 0 ? "VALIDATION_REQUIRED" : "READY_TO_IMPORT",
    preview
  };
}


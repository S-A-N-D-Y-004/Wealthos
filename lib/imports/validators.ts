import { z } from "zod";
import { importSourceSchema } from "@/lib/imports/broker-registry";

export const importPreviewRequestSchema = z.object({
  source: importSourceSchema,
  csv: z.string().min(1)
});

export const importMappingSchema = z.object({
  source: importSourceSchema,
  mapping: z.record(z.string(), z.string())
});


import { createHash } from "crypto";
import type { BrokerImportDefinition } from "@/lib/imports/broker-registry";

export type ParsedCsv = {
  headers: string[];
  rows: Array<Record<string, string>>;
};

export type ImportPreview = ParsedCsv & {
  detectedRows: number;
  validRows: number;
  rejectedRows: number;
  duplicateRows: number;
  errors: Array<{ row: number; message: string }>;
};

export function parseCsv(input: string): ParsedCsv {
  const lines = input
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index]?.trim() ?? "";
      return row;
    }, {});
  });

  return { headers, rows };
}

export function previewImport(csv: string, definition: BrokerImportDefinition): ImportPreview {
  const parsed = parseCsv(csv);
  const errors: ImportPreview["errors"] = [];
  const seen = new Set<string>();
  let validRows = 0;
  let duplicateRows = 0;

  for (const requiredColumn of definition.requiredColumns) {
    if (!parsed.headers.includes(requiredColumn)) {
      errors.push({ row: 0, message: `Missing required column: ${requiredColumn}` });
    }
  }

  parsed.rows.forEach((row, index) => {
    const missing = definition.requiredColumns.filter((column) => !row[column]);

    if (missing.length > 0) {
      errors.push({ row: index + 2, message: `Missing required values: ${missing.join(", ")}` });
      return;
    }

    const duplicateKey = hashDuplicateKey(row, definition.duplicateKeyColumns);

    if (seen.has(duplicateKey)) {
      duplicateRows += 1;
      errors.push({ row: index + 2, message: "Potential duplicate transaction detected" });
      return;
    }

    seen.add(duplicateKey);
    validRows += 1;
  });

  return {
    ...parsed,
    detectedRows: parsed.rows.length,
    validRows,
    duplicateRows,
    rejectedRows: Math.max(parsed.rows.length - validRows - duplicateRows, 0),
    errors
  };
}

export function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

export function hashDuplicateKey(row: Record<string, string>, columns: string[]) {
  const raw = columns.map((column) => `${column}:${row[column] ?? ""}`).join("|");
  return createHash("sha256").update(raw).digest("hex");
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && quoted && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}


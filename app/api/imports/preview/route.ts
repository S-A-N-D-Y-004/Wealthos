import { NextResponse } from "next/server";
import { getBrokerDefinition } from "@/lib/imports/broker-registry";
import { previewImport } from "@/lib/imports/csv";
import { importPreviewRequestSchema } from "@/lib/imports/validators";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = importPreviewRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const definition = getBrokerDefinition(parsed.data.source);
  const preview = previewImport(parsed.data.csv, definition);

  return NextResponse.json(preview);
}


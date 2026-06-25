import { apiServerError, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api/responses";
import { readJsonBody, validateJson } from "@/lib/api/request";
import { auth } from "@/lib/auth";
import { getBrokerDefinition } from "@/lib/imports/broker-registry";
import { previewImport } from "@/lib/imports/csv";
import { importPreviewRequestSchema } from "@/lib/imports/validators";

const IMPORT_PREVIEW_MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiUnauthorized();
    }

    const body = await readJsonBody(request, {
      maxBytes: IMPORT_PREVIEW_MAX_BYTES
    });

    if (!body.ok) {
      return apiValidationError(body.message, body.details);
    }

    const parsed = validateJson(
      importPreviewRequestSchema,
      body.data,
      "Import preview request failed validation."
    );

    if (!parsed.ok) {
      return apiValidationError(parsed.message, parsed.details);
    }

    const definition = getBrokerDefinition(parsed.data.source);
    const preview = previewImport(parsed.data.csv, definition);

    return apiSuccess(preview);
  } catch {
    return apiServerError();
  }
}

import { z } from "zod";

export type JsonReadResult =
  | {
      ok: true;
      data: unknown;
    }
  | {
      ok: false;
      message: string;
      details?: unknown;
    };

export type SchemaValidationResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      message: string;
      details?: unknown;
    };

export async function readJsonBody(
  request: Request,
  {
    maxBytes,
    allowEmpty = false
  }: {
    maxBytes?: number;
    allowEmpty?: boolean;
  } = {}
): Promise<JsonReadResult> {
  const contentLength = request.headers.get("content-length");

  if (maxBytes && contentLength && Number(contentLength) > maxBytes) {
    return {
      ok: false,
      message: `Request body exceeds the ${formatBytes(maxBytes)} limit.`
    };
  }

  const body = await request.text();

  if (maxBytes && new TextEncoder().encode(body).length > maxBytes) {
    return {
      ok: false,
      message: `Request body exceeds the ${formatBytes(maxBytes)} limit.`
    };
  }

  if (body.trim().length === 0) {
    if (allowEmpty) {
      return { ok: true, data: {} };
    }

    return {
      ok: false,
      message: "Request body is required."
    };
  }

  try {
    return {
      ok: true,
      data: JSON.parse(body)
    };
  } catch {
    return {
      ok: false,
      message: "Request body must be valid JSON."
    };
  }
}

export function validateJson<T>(
  schema: z.Schema<T>,
  data: unknown,
  message = "Request body failed validation."
): SchemaValidationResult<T> {
  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      message,
      details: parsed.error.flatten()
    };
  }

  return {
    ok: true,
    data: parsed.data
  };
}

function formatBytes(bytes: number) {
  const mib = bytes / (1024 * 1024);

  if (Number.isInteger(mib)) {
    return `${mib} MiB`;
  }

  return `${bytes} bytes`;
}

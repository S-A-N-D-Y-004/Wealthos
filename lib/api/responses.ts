import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INTERNAL_SERVER_ERROR";

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    {
      success: true,
      data
    },
    init
  );
}

export function apiValidationError(message: string, details?: unknown) {
  return apiError("VALIDATION_ERROR", 400, message, details);
}

export function apiUnauthorized() {
  return apiError("UNAUTHORIZED", 401);
}

export function apiServerError() {
  return apiError("INTERNAL_SERVER_ERROR", 500);
}

function apiError(code: ApiErrorCode, status: number, message?: string, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        ...(message ? { message } : {}),
        ...(details === undefined ? {} : { details })
      }
    },
    { status }
  );
}

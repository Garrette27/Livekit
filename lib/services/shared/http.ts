import { NextResponse } from 'next/server';
import type { ServiceResult } from './service-result';

/**
 * Maps a ServiceResult to the app's standard JSON HTTP envelope so every route
 * reports success/failure the same way.
 *
 * Success: `{ success: true, ...data }` when data is an object, else
 * `{ success: true, data }`. Failure: `{ success: false, error, code, details? }`
 * with the error's status code. This keeps the long-standing
 * `{ success, error }` shape that existing clients already expect.
 */
export function serviceResultToResponse<T>(result: ServiceResult<T>, successStatus = 200): NextResponse {
  if (result.ok) {
    const data = result.data;
    const body =
      data && typeof data === 'object' && !Array.isArray(data)
        ? { success: true, ...(data as Record<string, unknown>) }
        : { success: true, data };
    return NextResponse.json(body, { status: successStatus });
  }

  const error = result.error ?? { status: 500, code: 'internal_error', message: 'Unknown error' };
  return NextResponse.json(
    {
      success: false,
      error: error.message,
      code: error.code,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
    { status: error.status }
  );
}

import { NextResponse } from 'next/server';
import type { ServiceResult } from './service-result';
import {
  DATABASE_UNAVAILABLE_CODE,
  DATABASE_UNAVAILABLE_MESSAGE,
  isDatabaseUnavailableError,
} from './database-availability';

/**
 * Response for an error a route did not anticipate. Database availability
 * failures (quota, deadline, outage) become HTTP 503 with a retry message so
 * the person sees why the action failed; anything else stays a generic 500
 * that reveals no internals.
 */
export function unexpectedErrorResponse(error: unknown, init: { headers?: HeadersInit } = {}): NextResponse {
  if (isDatabaseUnavailableError(error)) {
    return NextResponse.json(
      { success: false, error: DATABASE_UNAVAILABLE_MESSAGE, code: DATABASE_UNAVAILABLE_CODE },
      { status: 503, headers: init.headers }
    );
  }
  return NextResponse.json(
    { success: false, error: 'Internal server error' },
    { status: 500, headers: init.headers }
  );
}

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

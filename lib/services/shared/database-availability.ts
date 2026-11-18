/**
 * Recognizes database failures that are about availability, not correctness.
 *
 * Firestore reports an exhausted quota, an expired deadline and a service
 * outage as gRPC status codes 8, 4 and 14 (the server SDK) or as the string
 * codes `resource-exhausted`, `deadline-exceeded` and `unavailable` (the web
 * SDK). Waiting fixes all three, for example until the free daily quota resets,
 * so callers report them as HTTP 503 with an honest retry message rather than
 * an opaque "Internal server error". Every other error remains a real fault.
 */

const UNAVAILABLE_GRPC_CODES = new Set([4, 8, 14]);
const UNAVAILABLE_STATUS_NAMES = new Set(['DEADLINE_EXCEEDED', 'RESOURCE_EXHAUSTED', 'UNAVAILABLE']);

export const DATABASE_UNAVAILABLE_CODE = 'database_unavailable';
export const DATABASE_UNAVAILABLE_MESSAGE =
  'The database is temporarily unavailable (for example, its free daily quota is used up). Please try again later.';

export function isDatabaseUnavailableError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  if (typeof code === 'number') {
    return UNAVAILABLE_GRPC_CODES.has(code);
  }
  if (typeof code === 'string') {
    return UNAVAILABLE_STATUS_NAMES.has(code.toUpperCase().replace(/-/g, '_'));
  }
  return false;
}

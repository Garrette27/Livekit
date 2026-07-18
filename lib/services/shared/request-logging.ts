import { AsyncLocalStorage } from 'node:async_hooks';
import { NextResponse } from 'next/server';

/**
 * Structured per-request logging for API routes.
 *
 * `withRequestLogging(handler)` wraps a route handler so that every request
 * emits exactly one JSON log line — method, path, query, status, duration,
 * and the authenticated user when known — and any uncaught error is logged
 * with its stack, then masked as the app's standard 500 envelope. Vercel
 * attaches these lines to the request row, and any log drain can index the
 * JSON fields, so routes get comprehensive observability without adding any
 * logging code of their own.
 */

interface RequestLogContext {
  userId?: string;
}

const requestLogContext = new AsyncLocalStorage<RequestLogContext>();

/**
 * Query parameters whose values must never reach logs (invite tokens,
 * credentials). Matched case-insensitively against the parameter name.
 */
const SENSITIVE_QUERY_PARAMS = new Set(['token', 'secret', 'key', 'apikey', 'api_key', 'code', 'password']);

/**
 * Attributes the current request's log line to an authenticated user.
 * Called by the shared auth helpers after token verification; safe to call
 * from anywhere — it is a no-op outside a logged request.
 */
export function recordAuthenticatedUser(userId: string): void {
  const context = requestLogContext.getStore();
  if (context) {
    context.userId = userId;
  }
}

function serializeQuery(url: URL): Record<string, string> | undefined {
  if (![...url.searchParams.keys()].length) {
    return undefined;
  }

  const query: Record<string, string> = {};
  url.searchParams.forEach((value, name) => {
    query[name] = SENSITIVE_QUERY_PARAMS.has(name.toLowerCase()) ? '[redacted]' : value;
  });
  return query;
}

function emitRequestLog(fields: {
  method: string;
  url: URL;
  status: number;
  durationMs: number;
  userId?: string;
  error?: unknown;
}): void {
  const { method, url, status, durationMs, userId, error } = fields;
  const line: Record<string, unknown> = {
    level: error ? 'error' : status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
    msg: 'api_request',
    method,
    path: url.pathname,
    status,
    durationMs,
  };

  const query = serializeQuery(url);
  if (query) line.query = query;
  if (userId) line.userId = userId;
  if (error) {
    line.error = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.stack) line.stack = error.stack;
  }

  console.log(JSON.stringify(line));
}

/**
 * Wraps a route handler with per-request structured logging. The handler's
 * behavior is unchanged: its request object, arguments, and response pass
 * through untouched. Uncaught errors become a `{ success: false }` 500
 * response after being logged, so no route can leak a raw stack to clients.
 */
export function withRequestLogging<Req extends Request, Args extends unknown[]>(
  handler: (req: Req, ...args: Args) => Promise<Response> | Response
): (req: Req, ...args: Args) => Promise<Response> {
  return async (req: Req, ...args: Args) => {
    const startedAt = Date.now();
    const url = new URL(req.url);
    const context: RequestLogContext = {};

    return requestLogContext.run(context, async () => {
      try {
        const response = await handler(req, ...args);
        emitRequestLog({
          method: req.method,
          url,
          status: response.status,
          durationMs: Date.now() - startedAt,
          userId: context.userId,
        });
        return response;
      } catch (error) {
        emitRequestLog({
          method: req.method,
          url,
          status: 500,
          durationMs: Date.now() - startedAt,
          userId: context.userId,
          error,
        });
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
      }
    });
  };
}

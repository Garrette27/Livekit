import { NextResponse } from 'next/server';
import { issueRoomMediaKey } from '@/lib/livekit/media-encryption';
import { withRequestLogging } from '@/lib/services/shared/request-logging';

/**
 * POST { accessToken } -> the room's end-to-end media key (or enabled:false).
 * The LiveKit consultation credential is the capability; no database read.
 * The key is never logged and the response is never cached.
 */
async function handlePOST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const accessToken = typeof body?.accessToken === 'string' ? body.accessToken.trim() : undefined;
  const result = issueRoomMediaKey(accessToken);
  return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } });
}

export const POST = withRequestLogging(handlePOST);

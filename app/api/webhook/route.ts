import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { WebhookReceiver } from 'livekit-server-sdk';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { withRateLimit, RateLimitConfigs } from '../../../lib/rate-limit';
import { isRoomEndEvent } from '../../../lib/webhooks/room-end-processor';
import { verifyWebhookSignature } from '../../../lib/webhooks/signature-utils';
import { processWebhookFinalizationFallback } from '../../../lib/webhooks/webhook-finalization-fallback';

// Room-end handling may run AI summarization; give it more than the 10s default.
export const maxDuration = 60;

/**
 * Confirms the webhook request really came from LiveKit. LiveKit signs each
 * delivery as a JWT in the Authorization header (verified via the server
 * SDK); a legacy HMAC header is also accepted. When verification material is
 * configured, an unverifiable request is rejected — omitting the header must
 * not bypass the check.
 */
async function verifyWebhookRequest(body: string, req: NextRequest): Promise<{ ok: boolean; reason: string }> {
  const authHeader = req.headers.get('authorization');
  const legacySignature = req.headers.get('x-livekit-signature') || req.headers.get('x-signature');
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const webhookSecret = process.env.LIVEKIT_WEBHOOK_SECRET;

  if (apiKey && apiSecret && authHeader) {
    try {
      await new WebhookReceiver(apiKey, apiSecret).receive(body, authHeader);
      return { ok: true, reason: 'livekit_jwt' };
    } catch (error) {
      console.error('LiveKit webhook JWT verification failed:', error);
      return { ok: false, reason: 'invalid_jwt' };
    }
  }

  if (webhookSecret && legacySignature) {
    return verifyWebhookSignature(body, legacySignature, webhookSecret)
      ? { ok: true, reason: 'legacy_hmac' }
      : { ok: false, reason: 'invalid_signature' };
  }

  if ((apiKey && apiSecret) || webhookSecret) {
    return { ok: false, reason: 'missing_credentials' };
  }

  console.warn('No webhook verification material configured - accepting unverified webhook');
  return { ok: true, reason: 'verification_disabled' };
}

async function handlePOST(req: NextRequest) {
  try {
    const rateLimitResponse = withRateLimit(RateLimitConfigs.WEBHOOK)(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await req.text();
    const verification = await verifyWebhookRequest(body, req);
    if (!verification.ok) {
      console.error('Rejected webhook request:', verification.reason);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('Webhook verified via:', verification.reason);

    let event: any;
    try {
      event = JSON.parse(body);
      console.log('Webhook received:', JSON.stringify(event, null, 2));
    } catch (error) {
      console.error('Invalid JSON in webhook body:', error);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (isRoomEndEvent(event)) {
      const db = getFirebaseAdmin();
      if (!db) {
        console.warn('Skipping webhook finalization fallback because Firebase Admin is not initialized.');
        return NextResponse.json({ success: true, skipped: true, reason: 'database_unavailable' });
      }

      const fallbackResult = await processWebhookFinalizationFallback(db, event);
      console.log(`Processed ${event.event} via webhook finalization fallback:`, fallbackResult);
      return NextResponse.json({
        success: true,
        skipped: !fallbackResult.handled,
        fallback: fallbackResult,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

export const POST = withRequestLogging(handlePOST);

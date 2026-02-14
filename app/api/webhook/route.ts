import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { withRateLimit, RateLimitConfigs } from '../../../lib/rate-limit';
import { isRoomEndEvent } from '../../../lib/webhooks/room-end-processor';
import { verifyWebhookSignature } from '../../../lib/webhooks/signature-utils';
import { processWebhookFinalizationFallback } from '../../../lib/webhooks/webhook-finalization-fallback';

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = withRateLimit(RateLimitConfigs.WEBHOOK)(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await req.text();
    const signature = req.headers.get('x-livekit-signature') || req.headers.get('x-signature');
    const webhookSecret = process.env.LIVEKIT_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      if (!verifyWebhookSignature(body, signature, webhookSecret)) {
        console.error('Invalid webhook signature');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      console.log('Webhook signature verified successfully');
    } else if (!webhookSecret) {
      console.warn('LIVEKIT_WEBHOOK_SECRET not configured - webhook signature verification disabled');
    }

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

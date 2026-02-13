import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, RateLimitConfigs } from '../../../lib/rate-limit';
import { processRoomEndEvent, isRoomEndEvent } from '../../../lib/webhooks/room-end-processor';
import { verifyWebhookSignature } from '../../../lib/webhooks/signature-utils';

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
      console.log(
        event.event === 'participant_left'
          ? 'Processing participant_left event (early summary mode)'
          : 'Processing room_finished event'
      );
      const result = await processRoomEndEvent(event);
      if (result.skipped) {
        return NextResponse.json({ success: true, skipped: true });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

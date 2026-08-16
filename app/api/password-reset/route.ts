import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, RateLimitConfigs } from '@/lib/rate-limit';
import { withRequestLogging } from '@/lib/services/shared/request-logging';

const GENERIC_RESET_MESSAGE =
  'If an eligible account exists for that email, password reset instructions will be sent.';

/**
 * Apply a coarse server-side throttle without looking up the account. Firebase
 * sends the email from the client after this preflight, while this endpoint
 * deliberately returns the same response for every syntactically valid email.
 */
async function handlePOST(req: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(req, RateLimitConfigs.AUTH);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  let email: unknown;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 });
  }

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  if (!looksLikeEmail) {
    return NextResponse.json(
      { success: false, error: 'Enter a valid email address.' },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { success: true, message: GENERIC_RESET_MESSAGE },
    {
      status: 202,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

export const POST = withRequestLogging(handlePOST);

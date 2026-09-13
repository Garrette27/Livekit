import { NextRequest, NextResponse } from 'next/server';
import { verifyVisitorIdentity } from '@/lib/auth/visitor-identity';
import {
  TELEHEALTH_CONSENT,
  telehealthConsentRecord,
} from '@/lib/consent/telehealth-consent';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { UserRepository } from '@/lib/repositories/user-repository';
import { enforceRateLimit, RateLimitConfigs } from '@/lib/rate-limit';
import { withRequestLogging } from '@/lib/services/shared/request-logging';

/**
 * Records that the signed-in patient agreed to the telehealth statement.
 *
 * This replaces a registration form that asked again for the email the account
 * already had, for a phone number nothing used, and for consent to keep
 * network and browser hashes on the profile. The account is the registration,
 * so the only input is which version of the statement the patient agreed to —
 * checked against the current one, so nobody is recorded as agreeing to words
 * they were not shown.
 *
 * The profile is written under the verified uid, never looked up by email.
 */
async function handlePOST(req: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(req, RateLimitConfigs.GENERAL);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const visitor = await verifyVisitorIdentity(req);
  const accountEmail = visitor?.authenticatedEmail?.toLowerCase().trim();
  if (!visitor?.userId || !accountEmail || visitor.isAnonymousAccount) {
    return NextResponse.json(
      { success: false, error: 'Sign in to record your agreement.' },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { consentVersion?: unknown };
  if (body.consentVersion !== TELEHEALTH_CONSENT.version) {
    return NextResponse.json(
      {
        success: false,
        error: 'The consent statement has been updated. Reload the page to read the current version.',
      },
      { status: 409 }
    );
  }

  const db = getFirebaseAdmin();
  if (!db) {
    return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 });
  }

  try {
    const users = new UserRepository(db);
    const profile = await users.getById(visitor.userId);
    const role = profile.exists ? profile.data()?.role : undefined;
    if (role && role !== 'patient') {
      return NextResponse.json(
        { success: false, error: 'This is not a patient account.' },
        { status: 409 }
      );
    }

    const now = new Date();
    await users.upsertById(visitor.userId, {
      ...telehealthConsentRecord(now),
      // A first visit can arrive before any sign-in screen wrote a profile. The
      // verified account supplies everything a patient profile needs.
      ...(profile.exists ? {} : { email: accountEmail, role: 'patient', registeredAt: now }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Could not record telehealth consent:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withRequestLogging(handlePOST);

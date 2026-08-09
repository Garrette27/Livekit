import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, RateLimitConfigs } from '../../../../lib/rate-limit';
import { getClientIP } from '../../../../lib/invitations/utils';
import { ValidateInvitationRequest } from '../../../../lib/types';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { FirestoreInvitationAccessCore } from '@/lib/services/invitation-access';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin';
import type { VisitorIdentity } from '@/lib/invitations/admission-policy';

/**
 * The visitor's identity as the identity provider attests it, or undefined when
 * they are browsing without an account. Never throws: an unusable token simply
 * means an unidentified visitor, who is queued rather than refused.
 */
async function resolveAuthenticatedVisitor(req: NextRequest): Promise<VisitorIdentity | undefined> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return undefined;
  }

  try {
    const decoded = await getFirebaseAdminAuth()?.verifyIdToken(authHeader.slice(7));
    if (!decoded) {
      return undefined;
    }

    return {
      userId: decoded.uid,
      authenticatedEmail: decoded.email || null,
      emailVerified: decoded.email_verified === true,
      isAnonymousAccount: decoded.firebase?.sign_in_provider === 'anonymous',
    };
  } catch (error) {
    console.warn('Ignoring unverifiable visitor token on invite validation:', error);
    return undefined;
  }
}

async function handlePOST(req: NextRequest) {
  const rateLimitResponse = withRateLimit(RateLimitConfigs.TOKEN_GENERATION)(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  let body: ValidateInvitationRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const db = getFirebaseAdmin();
  if (!db) {
    return NextResponse.json(
      { success: false, error: 'Database not available' },
      { status: 500 }
    );
  }

  // Optional: a visitor may hold no account at all. When they do send a token,
  // it is verified here so that skipping the waiting room can depend on it —
  // the request body is never trusted for identity.
  const invitationAccess = new FirestoreInvitationAccessCore(db);
  const result = await invitationAccess.validateInvite({
    token: body.token,
    deviceFingerprint: body.deviceFingerprint,
    userEmail: body.userEmail,
    clientIP: getClientIP(req),
    userAgent: req.headers.get('user-agent') || '',
    authenticatedVisitor: await resolveAuthenticatedVisitor(req),
  });

  return NextResponse.json(result.body, { status: result.status });
}

export const POST = withRequestLogging(handlePOST);

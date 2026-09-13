import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, RateLimitConfigs } from '../../../../lib/rate-limit';
import { getClientIP } from '../../../../lib/invitations/utils';
import { ValidateInvitationRequest } from '../../../../lib/types';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { FirestoreInvitationAccessCore } from '@/lib/services/invitation-access';
import { verifyVisitorIdentity } from '@/lib/auth/visitor-identity';

async function handlePOST(req: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(req, RateLimitConfigs.INVITATION_VALIDATION);
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
    userEmail: body.userEmail,
    clientIP: getClientIP(req),
    userAgent: req.headers.get('user-agent') || '',
    authenticatedVisitor: await verifyVisitorIdentity(req),
  });

  return NextResponse.json(result.body, { status: result.status });
}

export const POST = withRequestLogging(handlePOST);

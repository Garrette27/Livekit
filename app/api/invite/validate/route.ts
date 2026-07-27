import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, RateLimitConfigs } from '../../../../lib/rate-limit';
import { getClientIP } from '../../../../lib/invitations/utils';
import { ValidateInvitationRequest } from '../../../../lib/types';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { FirestoreInvitationAccessCore } from '@/lib/services/invitation-access';

async function handlePOST(req: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(req, RateLimitConfigs.TOKEN_GENERATION);
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

  const invitationAccess = new FirestoreInvitationAccessCore(db);
  const result = await invitationAccess.validateInvite({
    token: body.token,
    userEmail: body.userEmail,
    clientIP: getClientIP(req),
    userAgent: req.headers.get('user-agent') || '',
  });

  return NextResponse.json(result.body, { status: result.status });
}

export const POST = withRequestLogging(handlePOST);

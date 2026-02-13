import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, RateLimitConfigs } from '../../../../lib/rate-limit';
import { getClientIP } from '../../../../lib/invitations/utils';
import { ValidateInvitationRequest } from '../../../../lib/types';
import { validateInvitationAndIssueToken } from '../../../../lib/invitations/validate-service';

export async function POST(req: NextRequest) {
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

  const result = await validateInvitationAndIssueToken({
    token: body.token,
    deviceFingerprint: body.deviceFingerprint,
    userEmail: body.userEmail,
    clientIP: getClientIP(req),
    userAgent: req.headers.get('user-agent') || '',
  });

  return NextResponse.json(result.body, { status: result.status });
}

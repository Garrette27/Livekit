import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin, getFirebaseAdminAuth } from '@/lib/firebase-admin';
import { verifyInvitationToken } from '@/lib/invitations/token-utils';
import { InvitationRepository } from '@/lib/repositories/invitation-repository';
import { UserRepository } from '@/lib/repositories/user-repository';
import { enforceRateLimit, RateLimitConfigs } from '@/lib/rate-limit';
import { hashSecuritySignal } from '@/lib/security/security-signal';
import { withRequestLogging } from '@/lib/services/shared/request-logging';
import type {
  RegisterUserRequest,
  RegisterUserResponse,
} from '@/lib/types';
import { sanitizeInput, validateEmail } from '@/lib/validation';

/**
 * The caller's account id when they are signed in, or null when they are not.
 * Registration is deliberately open to visitors without an account, so an
 * absent or unusable token is a normal outcome rather than a failure.
 */
async function resolveVerifiedUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const decoded = await getFirebaseAdminAuth()?.verifyIdToken(authHeader.slice(7));
    return decoded?.uid || null;
  } catch (error) {
    console.warn('Ignoring unverifiable token during patient registration:', error);
    return null;
  }
}

function expirationDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }
  if (value && typeof value === 'object' && 'toDate' in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    return typeof toDate === 'function'
      ? (toDate as () => Date).call(value)
      : null;
  }
  return null;
}

/**
 * Registers an invited patient only after validating the signed invitation and
 * its persisted state. Registration establishes an account; it does not grant
 * direct admission. The validation service independently sends identities not
 * on the verified allowlist to the doctor-controlled waiting room.
 */
async function handlePOST(req: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(req, RateLimitConfigs.TOKEN_GENERATION);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = (await req.json()) as RegisterUserRequest;
    const { invitationToken, email, phone, consentGiven } = body;
    if (!invitationToken || !email || !consentGiven) {
      return NextResponse.json(
        { success: false, error: 'Invitation, email, and consent are required' },
        { status: 400 }
      );
    }
    if (!validateEmail(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 });
    }

    let tokenPayload;
    try {
      tokenPayload = verifyInvitationToken(invitationToken);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invitation is invalid or expired' },
        { status: 401 }
      );
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 });
    }

    const invitationDoc = await new InvitationRepository(db).getById(tokenPayload.invitationId);
    if (!invitationDoc.exists) {
      return NextResponse.json({ success: false, error: 'Invitation not found' }, { status: 404 });
    }

    const invitation = invitationDoc.data() as Record<string, unknown>;
    const expiresAt = expirationDate(invitation.expiresAt);
    if (
      invitation.status !== 'active'
      || invitation.roomName !== tokenPayload.roomName
      || (expiresAt && expiresAt.getTime() <= Date.now())
    ) {
      return NextResponse.json(
        { success: false, error: 'Invitation is no longer active' },
        { status: 410 }
      );
    }

    const sanitizedEmail = sanitizeInput(email.trim().toLowerCase());

    const clientIp = (
      req.headers.get('x-forwarded-for')?.split(',')[0]
      || req.headers.get('x-real-ip')
      || 'unknown'
    ).trim();
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const profileFields: Record<string, unknown> = {
      email: sanitizedEmail,
      consentGiven: true,
      consentGivenAt: new Date(),
      securityInfo: {
        networkHash: hashSecuritySignal('ip', clientIp),
        userAgentHash: hashSecuritySignal('user-agent', userAgent),
      },
      lastLoginAt: new Date(),
    };
    if (phone?.trim()) {
      profileFields.phone = sanitizeInput(phone.trim());
    }

    const users = new UserRepository(db);
    const existingUser = await users.findByEmail(sanitizedEmail);
    if (existingUser && existingUser.data()?.role !== 'patient') {
      return NextResponse.json(
        { success: false, error: 'This email belongs to a non-patient account' },
        { status: 409 }
      );
    }

    // A profile belongs to an account, so it is written under the caller's
    // verified uid. Registration is open to visitors who have not signed in
    // yet, and for them there is no account to attach a profile to — writing
    // one anyway is what produced profiles under generated ids that no sign-in
    // could ever match, and a second profile once the patient did sign in.
    // Their consent is recorded against the invitation instead, and the sign-in
    // path creates the profile under the right key.
    const verifiedUserId = await resolveVerifiedUserId(req);
    const profileUserId = verifiedUserId || (existingUser ? existingUser.id : null);

    if (profileUserId) {
      await users.upsertById(profileUserId, {
        ...profileFields,
        role: 'patient',
        ...(existingUser ? {} : { registeredAt: new Date() }),
      });
    } else {
      await new InvitationRepository(db).mergeFields(tokenPayload.invitationId, {
        audit: {
          consents: FieldValue.arrayUnion({
            emailHash: hashSecuritySignal('email', sanitizedEmail),
            consentGivenAt: new Date().toISOString(),
          }),
        },
      });
    }

    const response: RegisterUserResponse = { success: true, userId: profileUserId || undefined };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error registering invited patient:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);

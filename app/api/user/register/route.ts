import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
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

function allowedInvitationEmails(invitation: Record<string, unknown>): string[] {
  const metadata = (invitation.metadata as Record<string, unknown> | undefined) || {};
  const constraints = (metadata.constraints as Record<string, unknown> | undefined) || {};
  const candidates = [
    invitation.emailAllowed,
    constraints.email,
    ...(Array.isArray(constraints.emails) ? constraints.emails : []),
  ];
  return Array.from(new Set(
    candidates
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  ));
}

/**
 * Registers an invited patient only after validating the signed invitation and
 * its persisted state. Existing non-patient profiles are never rewritten.
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
    const allowlist = allowedInvitationEmails(invitation);
    if (
      (tokenPayload.email && tokenPayload.email.trim().toLowerCase() !== sanitizedEmail)
      || (allowlist.length > 0 && !allowlist.includes(sanitizedEmail))
    ) {
      return NextResponse.json(
        { success: false, error: 'Email does not match this invitation' },
        { status: 403 }
      );
    }

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
    let userId: string;
    if (existingUser) {
      if (existingUser.data()?.role !== 'patient') {
        return NextResponse.json(
          { success: false, error: 'This email belongs to a non-patient account' },
          { status: 409 }
        );
      }
      userId = existingUser.id;
      await users.update(userId, profileFields);
    } else {
      userId = await users.create({
        ...profileFields,
        role: 'patient',
        registeredAt: new Date(),
      });
    }

    const response: RegisterUserResponse = { success: true, userId };
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

import { getFirebaseAdmin } from '../firebase-admin';
import {
  AccessAttempt,
  Invitation,
  InvitationToken,
  SecurityViolation,
  ValidateInvitationResponse,
} from '../types';
import { signLiveKitRoomToken, verifyInvitationToken } from './token-utils';
import { toDate } from './utils';
import { buildWaitingPatientIdentity } from './waiting-patient-identity';
import { EVENT_DOMAINS, EVENT_SCHEMA_VERSION } from '../events/event-schema';
import {
  hasInvitationEmailAllowlist,
  isEmailAllowedByInvitation,
} from './email-allowlist';
import { decideAdmission, type VisitorIdentity } from './admission-policy';
import { finalizeConsultationForRoom } from '../services/consultation-finalization';
import { UserRepository } from '../repositories/user-repository';
import { hasTelehealthConsent } from '../consent/telehealth-consent';
import { FieldValue } from 'firebase-admin/firestore';
import { hashSecuritySignal } from '../security/security-signal';
import { resolveWaitingPatientId } from './waiting-patient-key';
import {
  reserveInvitationUse,
  reserveWaitingVisit,
  type WaitingVisitReservation,
} from './invitation-use-reservation';

export interface ValidateInvitationContext {
  token: string;
  /** Email the visitor typed. Self-asserted, so it never grants admission. */
  userEmail?: string;
  clientIP: string;
  userAgent: string;
  /**
   * Identity taken from a verified Firebase token, when the visitor sent one.
   * Only this can qualify someone to skip the waiting room.
   */
  authenticatedVisitor?: VisitorIdentity;
}

export interface ValidateInvitationResult {
  status: number;
  body: ValidateInvitationResponse;
}

interface UserLookupContext {
  userEmailToCheck?: string;
  userDocId?: string;
  userProfile?: any;
}

type WaitingPatientIdentity = ReturnType<typeof buildWaitingPatientIdentity>;

function result(status: number, body: ValidateInvitationResponse): ValidateInvitationResult {
  return { status, body };
}

function normalizeEmail(email?: string): string | undefined {
  return email ? email.toLowerCase().trim() : undefined;
}

function buildAccessAttempt(
  clientIP: string,
  userAgent: string
): AccessAttempt {
  const occurredAt = new Date() as any;
  return {
    eventDomain: EVENT_DOMAINS.INVITATION_AUDIT,
    eventType: 'access_attempt',
    eventVersion: EVENT_SCHEMA_VERSION,
    occurredAt,
    actorType: 'anonymous',
    actorId: null,
    metadata: {
      source: 'invitation-access-core.validateInvite',
      signalEncoding: 'hmac-sha256',
    },
    timestamp: occurredAt,
    networkHash: hashSecuritySignal('ip', clientIP),
    userAgentHash: hashSecuritySignal('user-agent', userAgent),
    success: false,
    reason: undefined,
  };
}

function toAccessAttemptData(accessAttempt: AccessAttempt): Record<string, any> {
  return {
    eventDomain: accessAttempt.eventDomain || EVENT_DOMAINS.INVITATION_AUDIT,
    eventType: accessAttempt.eventType || 'access_attempt',
    eventVersion: accessAttempt.eventVersion || EVENT_SCHEMA_VERSION,
    occurredAt: accessAttempt.occurredAt || accessAttempt.timestamp,
    actorType: accessAttempt.actorType || 'anonymous',
    actorId: typeof accessAttempt.actorId === 'string' ? accessAttempt.actorId : null,
    metadata: accessAttempt.metadata || {},
    timestamp: accessAttempt.timestamp,
    networkHash: accessAttempt.networkHash,
    userAgentHash: accessAttempt.userAgentHash,
    success: accessAttempt.success,
    reason: accessAttempt.reason,
  };
}

function buildSecurityViolation(input: {
  type: SecurityViolation['type'];
  details: string;
  clientIP: string;
  userAgent: string;
  actorType?: SecurityViolation['actorType'];
  actorId?: string | null;
}): SecurityViolation {
  const timestamp = new Date() as any;
  return {
    eventDomain: EVENT_DOMAINS.INVITATION_AUDIT,
    eventType: 'security_violation',
    eventVersion: EVENT_SCHEMA_VERSION,
    occurredAt: timestamp,
    actorType: input.actorType || 'anonymous',
    actorId: input.actorId || null,
    metadata: {
      source: 'invitation-access-core.validateInvite',
    },
    timestamp,
    type: input.type,
    details: input.details,
    networkHash: hashSecuritySignal('ip', input.clientIP),
    userAgentHash: hashSecuritySignal('user-agent', input.userAgent),
  };
}

function buildParticipantDisplayName(lookup: UserLookupContext): string {
  return (
    lookup.userProfile?.displayName
    || lookup.userEmailToCheck
    || 'Anonymous Patient'
  );
}

/**
 * Places a visitor on their queue entry for this invitation through the
 * atomic reservation (capacity, use counting, visit binding, audit).
 * `waitingPatientId` must come from resolveWaitingPatientId, and
 * `principalKeyed` says whether it was derived from a verified Firebase uid.
 */
async function reserveWaitingPatient(
  db: any,
  input: {
    invitationId: string;
    roomName: string;
    doctorUserId: string;
    waitingPatientId: string;
    principalKeyed: boolean;
    identity: WaitingPatientIdentity;
    status: 'waiting' | 'admitted';
    networkHash: string;
    userAgentHash: string;
    admissionMode: 'doctor-manual' | 'auto-email-match';
    riskSignals?: string[];
    accessAttemptData: Record<string, any>;
  }
): Promise<WaitingVisitReservation> {
  const now = new Date();
  const onNewVisit: Record<string, unknown> = {
    id: input.waitingPatientId,
    invitationId: input.invitationId,
  };

  // The email shown to the doctor is a label with provenance
  // (metadata.identitySource); it never selects which entry is used.
  const onEachVisit: Record<string, unknown> = {
    patientId: input.identity.patientId,
    patientName: input.identity.patientName,
    ...(input.identity.patientEmail && { patientEmail: input.identity.patientEmail }),
    roomName: input.roomName,
    doctorUserId: input.doctorUserId,
    lastSeenAt: now,
    visitCount: FieldValue.increment(1),
    metadata: {
      networkHash: input.networkHash,
      userAgentHash: input.userAgentHash,
      lastAccessed: now,
      admissionMode: input.admissionMode,
      isAnonymous: input.identity.isAnonymous,
      identitySource: input.identity.identitySource,
      ...(input.riskSignals && input.riskSignals.length > 0 ? { riskSignals: input.riskSignals } : {}),
    },
  };

  return reserveWaitingVisit(db, input.invitationId, input.accessAttemptData, {
    id: input.waitingPatientId,
    roomName: input.roomName,
    status: input.status,
    principalKeyed: input.principalKeyed,
    onNewVisit,
    onEachVisit,
    // Each arrival is kept as its own immutable record, so the entry can be a
    // single current state without losing its history.
    visit: {
      arrivedAt: now,
      requestedStatus: input.status,
      networkHash: input.networkHash,
      userAgentHash: input.userAgentHash,
      admissionMode: input.admissionMode,
      ...(input.riskSignals && input.riskSignals.length > 0 ? { riskSignals: input.riskSignals } : {}),
    },
    newVisitId: globalThis.crypto.randomUUID(),
  });
}

/** Maps a refused reservation to the visitor-facing response. */
function refusedReservationResult(reservation: WaitingVisitReservation): ValidateInvitationResult {
  if (reservation.outcome === 'full') {
    return result(403, {
      success: false,
      error: `Waiting room is full. Maximum ${reservation.maxPatients} patients allowed.`,
    });
  }
  return result(409, {
    success: false,
    error: 'This invitation is no longer available. Ask the doctor for a new link.',
  });
}

/**
 * Establishes who is at the door, and whether anything must happen before they
 * can be placed.
 *
 * A signed-in visitor is identified by their account, however they signed in.
 * Their profile is read by uid — never searched for by email — and the only
 * precondition is agreement to the telehealth statement: the account already
 * is the registration. A visitor without an account is a guest. Nothing a
 * guest types can admit them, so nothing is demanded of them here; the doctor
 * decides in the waiting room.
 */
async function resolveUserContext(
  db: any,
  invitation: Invitation,
  tokenPayload: InvitationToken,
  declaredEmail: string | undefined,
  visitor: VisitorIdentity | undefined,
  clientIP: string,
  userAgent: string,
  violations: SecurityViolation[]
): Promise<{ lookup: UserLookupContext; earlyResult?: ValidateInvitationResult }> {
  const accountId = visitor && !visitor.isAnonymousAccount ? visitor.userId || undefined : undefined;
  const accountEmail = accountId ? normalizeEmail(visitor?.authenticatedEmail || undefined) : undefined;

  const lookup: UserLookupContext = accountId && accountEmail
    ? { userEmailToCheck: accountEmail, userDocId: accountId }
    : {
        // The token claim is read only for links issued before allowlists moved
        // out of JWTs. Like a typed address it only labels the guest for the
        // doctor; it never links them to anyone's records.
        userEmailToCheck: normalizeEmail(declaredEmail || tokenPayload.email),
      };

  if (lookup.userDocId) {
    const profileDoc = await new UserRepository(db).getById(lookup.userDocId);
    lookup.userProfile = profileDoc.exists ? profileDoc.data() : undefined;

    const role = lookup.userProfile?.role;
    if (role && role !== 'patient') {
      return {
        lookup,
        earlyResult: result(403, {
          success: false,
          error: 'You are signed in with a clinician or staff account. To join as the patient, open this link in a private window or sign out first.',
        }),
      };
    }

    // Asked once per account, at the point of care. A first visit can arrive
    // before any sign-in screen wrote a profile; recording consent creates it.
    if (!hasTelehealthConsent(lookup.userProfile)) {
      return {
        lookup,
        earlyResult: result(403, {
          success: false,
          requiresConsent: true,
          error: 'Please read and accept the consultation consent to continue.',
        }),
      };
    }
  }

  if (
    lookup.userEmailToCheck
    && hasInvitationEmailAllowlist(invitation)
    && !isEmailAllowedByInvitation(invitation, lookup.userEmailToCheck)
  ) {
    violations.push(
      buildSecurityViolation({
        type: 'wrong_email',
        details: 'The presented email is not on this invitation allowlist.',
        clientIP,
        userAgent,
        actorType: lookup.userDocId ? 'patient' : 'anonymous',
        actorId: lookup.userDocId || null,
      })
    );
  }

  return { lookup };
}

/**
 * Audits an access attempt made from an unfamiliar context. The visit
 * continues — the signals are carried into the admission decision so the
 * patient is queued for the doctor rather than turned away.
 */
async function recordAccessRisk(
  db: any,
  invitationId: string,
  accessAttempt: AccessAttempt,
  violations: SecurityViolation[]
): Promise<void> {
  accessAttempt.reason = `Risk signals: ${violations.map((violation) => violation.type).join(', ')}`;

  try {
    const invitationRef = db.collection('invitations').doc(invitationId);
    const batch = db.batch();
    batch.update(invitationRef, { 'audit.lastAccessed': new Date() });
    violations.forEach((violation) => {
      // One latest event per violation category gives the clinician useful
      // context while keeping this subcollection strictly bounded.
      batch.set(invitationRef.collection('violations').doc(violation.type), violation);
    });
    await batch.commit();
  } catch (auditError) {
    // Auditing must not decide whether a patient can reach their appointment.
    console.error('Failed to record invitation access risk:', auditError);
  }
}

/**
 * Fast refusal for an invitation that is visibly used up, so the visitor gets
 * a clear message before identity work. Authoritative use and capacity limits
 * are rechecked inside the reservation transactions.
 */
function validateUsageLimits(
  invitation: Invitation,
  isWaitingRoomEnabled: boolean
): ValidateInvitationResult | null {
  if (isWaitingRoomEnabled) {
    // Waiting target and use limit are enforced only inside
    // reserveWaitingVisit. A check here would run outside that transaction and
    // would also refuse a reconnect to a visit that is still open, which
    // neither adds a waiting row nor spends a use.
    return null;
  }

  if (invitation.usedAt) {
    return result(403, {
      success: false,
      error: 'This invitation has already been used.',
    });
  }

  return null;
}

/**
 * Decides and issues the credential for a waiting-room invitation.
 *
 * Only a non-anonymous, provider-verified account on the allowlist may ask for
 * direct entry; everyone else (and anyone the doctor rejected on this entry)
 * receives a media-disabled waiting credential. Both paths go through the same
 * atomic reservation, so reconnects reuse the open visit and every credential
 * names that visit.
 */
async function handleWaitingRoomAccess(params: {
  db: any;
  tokenPayload: InvitationToken;
  invitation: Invitation;
  lookup: UserLookupContext;
  explicitUserEmail?: string;
  authenticatedVisitor?: VisitorIdentity;
  riskSignals?: string[];
  accessAttemptData: Record<string, any>;
  participantDisplayName: string;
  waitingRoomName: string;
  clientIP: string;
  userAgent: string;
}): Promise<ValidateInvitationResult> {
  const {
    db,
    tokenPayload,
    invitation,
    lookup,
    explicitUserEmail,
    authenticatedVisitor,
    riskSignals,
    accessAttemptData,
    participantDisplayName,
    waitingRoomName,
    clientIP,
    userAgent,
  } = params;

  const doctorUserId = invitation.createdBy;
  if (!doctorUserId || doctorUserId === 'system') {
    console.error('CRITICAL: Cannot create waiting patient - doctorUserId is invalid:', {
      invitationId: tokenPayload.invitationId,
    });
    return result(500, {
      success: false,
      error: 'Invalid invitation: doctor not associated with invitation',
    });
  }

  const identity = buildWaitingPatientIdentity({
    explicitUserEmail,
    // A signed-in visitor's address is the one their account holds, as the
    // identity provider attests it. A guest has only what they declared.
    profileEmail: lookup.userDocId ? lookup.userEmailToCheck : undefined,
    invitationEmail: tokenPayload.email,
    userDocId: lookup.userDocId,
  });

  // Skipping the waiting room requires a verified identity, never a typed
  // address. Everyone else — including anonymous guests — is queued for the
  // doctor rather than turned away.
  const admission = decideAdmission({
    visitor: {
      ...(authenticatedVisitor || {}),
      declaredEmail: identity.patientEmail || explicitUserEmail,
    },
    allowlistConfigured: hasInvitationEmailAllowlist(invitation),
    verifiedEmailAllowed: isEmailAllowedByInvitation(
      invitation,
      authenticatedVisitor?.authenticatedEmail || undefined
    ),
    riskSignals,
  });
  const requestsDirectEntry = admission.admit === 'directly';

  const networkHash = hashSecuritySignal('ip', clientIP);
  const userAgentHash = hashSecuritySignal('user-agent', userAgent);
  const principalId = authenticatedVisitor?.userId?.trim() || null;
  const waitingPatientId = resolveWaitingPatientId({
    invitationId: tokenPayload.invitationId,
    principalId,
    networkHash,
    userAgentHash,
  });

  const reservation = await reserveWaitingPatient(db, {
    invitationId: tokenPayload.invitationId,
    roomName: tokenPayload.roomName,
    doctorUserId,
    waitingPatientId,
    principalKeyed: Boolean(principalId),
    identity,
    status: requestsDirectEntry ? 'admitted' : 'waiting',
    networkHash,
    userAgentHash,
    admissionMode: requestsDirectEntry ? 'auto-email-match' : 'doctor-manual',
    riskSignals,
    accessAttemptData,
  });
  if (reservation.outcome !== 'reserved') {
    return refusedReservationResult(reservation);
  }

  const subject = `patient_${tokenPayload.invitationId}_${waitingPatientId}`;
  if (requestsDirectEntry && reservation.status === 'admitted') {
    return result(200, {
      success: true,
      liveKitToken: signLiveKitRoomToken({
        subject,
        patientUserId: lookup.userDocId,
        visitId: reservation.visitId,
        roomName: tokenPayload.roomName,
        participantName: participantDisplayName,
        expiresIn: '2h',
      }),
      roomName: tokenPayload.roomName,
      waitingRoomToken: false,
      waitingRoomEnabled: false,
      invitationId: tokenPayload.invitationId,
      waitingPatientId,
    });
  }

  // Waiting credentials authorize admission polling only. A visitor whose
  // open visit the doctor already admitted receives the consultation grant
  // from that poll, after the server re-checks the visit.
  return result(200, {
    success: true,
    liveKitToken: signLiveKitRoomToken({
      subject,
      visitId: reservation.visitId,
      roomName: waitingRoomName,
      purpose: 'waiting',
      participantName: participantDisplayName,
      expiresIn: '1h',
    }),
    roomName: waitingRoomName,
    waitingRoomToken: true,
    waitingRoomEnabled: true,
    invitationId: tokenPayload.invitationId,
    waitingPatientId,
  });
}

export async function validateInvitationAndIssueToken(
  context: ValidateInvitationContext
): Promise<ValidateInvitationResult> {
  try {
    if (!context.token) {
      return result(400, { success: false, error: 'Invitation token is required' });
    }

    let tokenPayload: InvitationToken;
    try {
      tokenPayload = verifyInvitationToken(context.token);
    } catch {
      return result(401, { success: false, error: 'Invalid or expired invitation token' });
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return result(500, { success: false, error: 'Database not available' });
    }

    const invitationDoc = await db.collection('invitations').doc(tokenPayload.invitationId).get();
    if (!invitationDoc.exists) {
      return result(404, { success: false, error: 'Invitation not found' });
    }

    const invitation = invitationDoc.data() as Invitation;
    if (!invitation.roomName || invitation.roomName !== tokenPayload.roomName) {
      return result(401, { success: false, error: 'Invalid invitation room binding' });
    }

    const expiresAtDate = toDate(invitation.expiresAt, new Date());
    const expiredByTime = new Date() > expiresAtDate;
    if ((invitation.status === 'active' || !invitation.status) && expiredByTime) {
      try {
        await db.collection('invitations').doc(tokenPayload.invitationId).set(
          {
            status: 'expired',
            expiredAt: expiresAtDate,
          },
          { merge: true }
        );
        await finalizeConsultationForRoom(db, {
          roomName: invitation.roomName || tokenPayload.roomName,
          finalizedAt: expiresAtDate,
          reason: 'invitation_expired',
          regenerateSummary: true,
        });
      } catch (expirationFinalizeError) {
        console.error('Failed to finalize consultation during invite expiration:', expirationFinalizeError);
      }
    }

    if (invitation.status === 'expired' || expiredByTime) {
      return result(403, { success: false, error: 'Invitation has expired' });
    }
    if (invitation.status === 'cancelled' || invitation.status === 'revoked') {
      return result(403, { success: false, error: 'Invitation has been cancelled or revoked' });
    }

    const accessAttempt = buildAccessAttempt(context.clientIP, context.userAgent);
    const violations: SecurityViolation[] = [];

    const userResolution = await resolveUserContext(
      db,
      invitation,
      tokenPayload,
      context.userEmail,
      context.authenticatedVisitor,
      context.clientIP,
      context.userAgent,
      violations
    );
    if (userResolution.earlyResult) {
      return userResolution.earlyResult;
    }

    accessAttempt.actorType = userResolution.lookup.userDocId ? 'patient' : 'anonymous';
    accessAttempt.actorId = userResolution.lookup.userDocId || null;
    accessAttempt.metadata = {
      ...(accessAttempt.metadata || {}),
      invitationId: tokenPayload.invitationId,
      roomName: tokenPayload.roomName,
      waitingRoomEnabled: invitation.waitingRoomEnabled === true,
    };

    const isWaitingRoomEnabled = invitation.waitingRoomEnabled === true;
    const waitingRoomName = isWaitingRoomEnabled
      ? `${tokenPayload.roomName}-waiting`
      : tokenPayload.roomName;

    // A declared or signed-in identity outside the allowlist is evidence for a
    // manual doctor decision, not grounds to lock a patient out of a booked
    // visit. Raw IP addresses, browser strings, and device fingerprints are not
    // collected; only keyed correlation hashes enter the audit trail.
    if (violations.length > 0) {
      await recordAccessRisk(db, tokenPayload.invitationId, accessAttempt, violations);
    }

    const usageError = validateUsageLimits(invitation, isWaitingRoomEnabled);
    if (usageError) {
      return usageError;
    }

    const participantDisplayName = buildParticipantDisplayName(userResolution.lookup);

    accessAttempt.success = true;
    accessAttempt.reason = 'Access granted successfully';
    const accessAttemptData = toAccessAttemptData(accessAttempt);

    if (isWaitingRoomEnabled) {
      return await handleWaitingRoomAccess({
        db,
        tokenPayload,
        invitation,
        lookup: userResolution.lookup,
        explicitUserEmail: context.userEmail,
        authenticatedVisitor: context.authenticatedVisitor,
        riskSignals: violations.map((violation) => violation.type),
        accessAttemptData,
        participantDisplayName,
        waitingRoomName,
        clientIP: context.clientIP,
        userAgent: context.userAgent,
      });
    }

    const liveKitToken = signLiveKitRoomToken({
      subject: `patient_${tokenPayload.invitationId}_${Date.now()}`,
      patientUserId: userResolution.lookup.userDocId,
      roomName: tokenPayload.roomName,
      participantName: participantDisplayName,
      expiresIn: '1h',
    });

    const reserved = await reserveInvitationUse(
      db,
      tokenPayload.invitationId,
      accessAttemptData,
      {
        markUsed: true,
        usedByHash: hashSecuritySignal('ip', context.clientIP),
      }
    );
    if (!reserved) {
      return result(409, {
        success: false,
        error: 'This invitation is no longer available. Ask the doctor for a new link.',
      });
    }

    return result(200, {
      success: true,
      liveKitToken,
      roomName: tokenPayload.roomName,
      waitingRoomEnabled: false,
      invitationId: tokenPayload.invitationId,
    });
  } catch (error) {
    console.error('Error validating invitation:', error);
    return result(500, { success: false, error: 'Internal server error' });
  }
}

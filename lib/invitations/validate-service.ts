import { getFirebaseAdmin } from '../firebase-admin';
import {
  AccessAttempt,
  Invitation,
  InvitationToken,
  SecurityViolation,
  ValidateInvitationResponse,
  WaitingPatient,
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
import { hashSecuritySignal } from '../security/security-signal';
import {
  recordExistingInvitationAccess,
  reserveInvitationUse,
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

function toMillis(value: any): number {
  if (!value) {
    return 0;
  }
  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function buildParticipantDisplayName(lookup: UserLookupContext): string {
  return (
    lookup.userProfile?.displayName
    || lookup.userEmailToCheck
    || 'Anonymous Patient'
  );
}

function createWaitingPatientId(invitationId: string): string {
  return `waiting_${invitationId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Prior waiting-room entries for this patient on this invitation.
 *
 * `hasEndedVisit` means a visit has already finished — it exists to stop a
 * finished entry being handed back as if the patient were still in the room.
 * It is deliberately not a judgement about whether they may return: patients
 * close tabs constantly, and treating that as permanent would revoke the
 * doctor's skip-the-queue decision after one visit.
 */
async function lookupRegisteredAdmissionHistory(
  db: any,
  invitationId: string,
  patientEmail: string
): Promise<{ hasEndedVisit: boolean; latestAdmitted: WaitingPatient | null }> {
  const existingPatientsQuery = await db.collection('waitingPatients')
    .where('invitationId', '==', invitationId)
    .where('patientEmail', '==', patientEmail)
    .get();

  if (existingPatientsQuery.empty) {
    return { hasEndedVisit: false, latestAdmitted: null };
  }

  let hasEndedVisit = false;
  let latestAdmitted: WaitingPatient | null = null;
  let latestAdmittedTime = 0;

  existingPatientsQuery.docs.forEach((doc: any) => {
    const data = { id: doc.id, ...doc.data() } as WaitingPatient;

    if (data.status === 'left' || data.status === 'rejected') {
      hasEndedVisit = true;
      return;
    }

    if (data.status === 'admitted') {
      const joinedAtMillis = toMillis(data.joinedAt);
      if (!latestAdmitted || joinedAtMillis >= latestAdmittedTime) {
        latestAdmitted = data;
        latestAdmittedTime = joinedAtMillis;
      }
    }
  });

  return { hasEndedVisit, latestAdmitted };
}

async function reserveWaitingPatient(
  db: any,
  input: {
    invitationId: string;
    roomName: string;
    doctorUserId: string;
    identity: WaitingPatientIdentity;
    status: WaitingPatient['status'];
    clientIP: string;
    userAgent: string;
    admissionMode?: 'doctor-manual' | 'auto-email-match';
    riskSignals?: string[];
    accessAttemptData: Record<string, any>;
  }
): Promise<string | null> {
  const waitingPatientId = createWaitingPatientId(input.invitationId);
  const now = new Date();

  const waitingPatient: any = {
    id: waitingPatientId,
    patientId: input.identity.patientId,
    patientName: input.identity.patientName,
    ...(input.identity.patientEmail && { patientEmail: input.identity.patientEmail }),
    roomName: input.roomName,
    invitationId: input.invitationId,
    doctorUserId: input.doctorUserId,
    joinedAt: now,
    status: input.status,
    metadata: {
      networkHash: hashSecuritySignal('ip', input.clientIP),
      userAgentHash: hashSecuritySignal('user-agent', input.userAgent),
      lastAccessed: now,
      ...(input.admissionMode && { admissionMode: input.admissionMode }),
      isAnonymous: input.identity.isAnonymous,
      // Recorded so the doctor's queue can show how the visitor's email was
      // established rather than presenting every address with equal weight.
      identitySource: input.identity.identitySource,
      ...(input.riskSignals && input.riskSignals.length > 0
        ? { riskSignals: input.riskSignals }
        : {}),
    },
  };

  if (input.status === 'admitted') {
    waitingPatient.admittedAt = now;
  }

  const reserved = await reserveInvitationUse(
    db,
    input.invitationId,
    input.accessAttemptData,
    {
      waitingPatient: {
        id: waitingPatientId,
        data: waitingPatient,
      },
    }
  );
  return reserved ? waitingPatientId : null;
}

async function resolveUserContext(
  db: any,
  invitation: Invitation,
  tokenPayload: InvitationToken,
  userEmail: string | undefined,
  authenticatedEmail: string | undefined,
  clientIP: string,
  userAgent: string,
  violations: SecurityViolation[]
): Promise<{ lookup: UserLookupContext; earlyResult?: ValidateInvitationResult }> {
  const lookup: UserLookupContext = {
    // The token claim is read only for links issued before allowlists moved out
    // of JWTs. It remains self-declared and never grants direct admission.
    userEmailToCheck: normalizeEmail(authenticatedEmail || userEmail || tokenPayload.email),
  };

  if (!lookup.userEmailToCheck) {
    console.log('Open invitation (no email constraint) - allowing access');
    return { lookup };
  }

  const userDoc = await new UserRepository(db).findByEmail(lookup.userEmailToCheck);

  if (!userDoc) {
    return {
      lookup,
      earlyResult: result(403, {
        success: false,
        error: 'User not registered. Please register first.',
        requiresRegistration: true,
        registeredEmail: lookup.userEmailToCheck,
      }),
    };
  }

  lookup.userDocId = userDoc.id;
  lookup.userProfile = userDoc.data();

  if (!lookup.userProfile.consentGiven) {
    return {
      lookup,
      earlyResult: result(403, {
        success: false,
        error: 'Consent is required before joining this consultation.',
        requiresRegistration: true,
        registeredEmail: lookup.userEmailToCheck,
      }),
    };
  }

  if (
    hasInvitationEmailAllowlist(invitation)
    && !isEmailAllowedByInvitation(invitation, lookup.userEmailToCheck)
  ) {
    violations.push(
      buildSecurityViolation({
        type: 'wrong_email',
        details: 'The presented account is not on this invitation allowlist.',
        clientIP,
        userAgent,
        actorType: 'patient',
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

async function validateUsageLimits(
  db: any,
  invitation: Invitation,
  invitationId: string,
  roomName: string,
  isWaitingRoomEnabled: boolean
): Promise<ValidateInvitationResult | null> {
  if (isWaitingRoomEnabled) {
    const maxPatients = invitation.maxPatients || 10;
    const currentWaitingQuery = await db.collection('waitingPatients')
      .where('roomName', '==', roomName)
      .where('invitationId', '==', invitationId)
      .where('status', '==', 'waiting')
      .get();

    if (currentWaitingQuery.size >= maxPatients) {
      return result(403, {
        success: false,
        error: `Waiting room is full. Maximum ${maxPatients} patients allowed.`,
      });
    }

    const currentUses = invitation.currentUses || 0;
    if (invitation.maxUses && currentUses >= invitation.maxUses) {
      return result(403, {
        success: false,
        error: 'Invitation has reached maximum number of uses.',
      });
    }

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

async function findExistingWaitingPatient(
  db: any,
  invitationId: string,
  identity: WaitingPatientIdentity,
  clientIP: string,
  userAgent: string
): Promise<WaitingPatient | null> {
  const existingPatientsQuery = await db.collection('waitingPatients')
    .where('invitationId', '==', invitationId)
    .get();

  if (existingPatientsQuery.empty) {
    return null;
  }

  const waitingPatients: WaitingPatient[] = existingPatientsQuery.docs
    .map((doc: any) => ({ id: doc.id, ...doc.data() } as WaitingPatient))
    .filter((patient: WaitingPatient) => patient.status === 'waiting')
    .sort((left: WaitingPatient, right: WaitingPatient) => toMillis(right.joinedAt) - toMillis(left.joinedAt));

  if (identity.patientEmail) {
    const normalizedIdentityEmail = normalizeEmail(identity.patientEmail);
    const exactIdentityMatch = waitingPatients.find((patient: WaitingPatient) => {
      const normalizedPatientEmail = normalizeEmail(patient.patientEmail);
      if (normalizedPatientEmail && normalizedIdentityEmail && normalizedPatientEmail === normalizedIdentityEmail) {
        return true;
      }

      if (identity.patientId && identity.patientId !== 'anonymous' && patient.patientId) {
        return patient.patientId === identity.patientId;
      }

      return false;
    });

    return exactIdentityMatch || null;
  }

  const nowMs = Date.now();
  const twoMinutesAgo = nowMs - (2 * 60 * 1000);
  const networkHash = hashSecuritySignal('ip', clientIP);
  const userAgentHash = hashSecuritySignal('user-agent', userAgent);
  const anonymousCandidate = waitingPatients.find((patient: WaitingPatient) => {
    const joinedTime = toMillis(patient.joinedAt);
    if (joinedTime <= twoMinutesAgo) {
      return false;
    }

    const patientEmail = normalizeEmail(patient.patientEmail);
    if (patientEmail) {
      return false;
    }

    const isAnonymousByMetadata = Boolean(patient.metadata?.isAnonymous);
    if (!isAnonymousByMetadata && patient.patientName && patient.patientName !== 'Anonymous Patient') {
      return false;
    }

    const matchesHashedSignals =
      patient.metadata?.networkHash === networkHash
      && patient.metadata?.userAgentHash === userAgentHash;
    const matchesLegacySignals =
      patient.metadata?.ip === clientIP
      && patient.metadata?.userAgent === userAgent;

    return matchesHashedSignals || matchesLegacySignals;
  });

  return anonymousCandidate || null;
}

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
      doctorUserId,
      invitationCreatedBy: invitation.createdBy,
      invitationId: tokenPayload.invitationId,
    });
    return result(500, {
      success: false,
      error: 'Invalid invitation: doctor not associated with invitation',
    });
  }

  const identity = buildWaitingPatientIdentity({
    explicitUserEmail,
    profileEmail: lookup.userProfile?.email,
    invitationEmail: lookup.userEmailToCheck,
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

  if (admission.admit === 'directly' && identity.patientEmail) {
    const admissionHistory = await lookupRegisteredAdmissionHistory(
      db,
      tokenPayload.invitationId,
      identity.patientEmail
    );

    // Rejoin an admission that is still open, so a refresh or a dropped
    // connection returns to the same encounter instead of starting a second
    // one. Once that visit has ended its entry is history and is not reused.
    if (admissionHistory.latestAdmitted && !admissionHistory.hasEndedVisit) {
      const accessRecorded = await recordExistingInvitationAccess(
        db,
        tokenPayload.invitationId,
        accessAttemptData
      );
      if (!accessRecorded) {
        return result(409, {
          success: false,
          error: 'This invitation is no longer available. Ask the doctor for a new link.',
        });
      }

      const admittedToken = signLiveKitRoomToken({
        subject: `patient_${tokenPayload.invitationId}_${admissionHistory.latestAdmitted.id}`,
        roomName: tokenPayload.roomName,
        participantName: participantDisplayName,
        expiresIn: '2h',
      });

      return result(200, {
        success: true,
        liveKitToken: admittedToken,
        roomName: tokenPayload.roomName,
        waitingRoomToken: false,
        waitingRoomEnabled: false,
        invitationId: tokenPayload.invitationId,
        waitingPatientId: admissionHistory.latestAdmitted.id,
      });
    }

    // Otherwise admit afresh. A visit that already ended must not disqualify
    // this one: closing the tab is something patients do constantly, and
    // treating it as permanent would silently revoke the doctor's own
    // skip-the-queue decision after a single visit.
    const admittedWaitingPatientId = await reserveWaitingPatient(db, {
      invitationId: tokenPayload.invitationId,
      roomName: tokenPayload.roomName,
      doctorUserId,
      identity,
      status: 'admitted',
      clientIP,
      userAgent,
      admissionMode: 'auto-email-match',
      riskSignals,
      accessAttemptData,
    });
    if (!admittedWaitingPatientId) {
      return result(409, {
        success: false,
        error: 'This invitation is no longer available. Ask the doctor for a new link.',
      });
    }

    const admittedToken = signLiveKitRoomToken({
      subject: `patient_${tokenPayload.invitationId}_${admittedWaitingPatientId}`,
      roomName: tokenPayload.roomName,
      participantName: participantDisplayName,
      expiresIn: '2h',
    });

    return result(200, {
      success: true,
      liveKitToken: admittedToken,
      roomName: tokenPayload.roomName,
      waitingRoomToken: false,
      waitingRoomEnabled: false,
      invitationId: tokenPayload.invitationId,
      waitingPatientId: admittedWaitingPatientId,
    });
  }

  const existingWaitingPatient = await findExistingWaitingPatient(
    db,
    tokenPayload.invitationId,
    identity,
    clientIP,
    userAgent
  );

  if (existingWaitingPatient) {
    console.log('Existing waiting patient found, reusing instead of creating duplicate:', {
      waitingPatientId: existingWaitingPatient.id,
      invitationId: tokenPayload.invitationId,
    });

    const patch: Record<string, unknown> = {
      'metadata.lastAccessed': new Date(),
    };
    if (!existingWaitingPatient.patientEmail && identity.patientEmail) {
      patch.patientEmail = identity.patientEmail;
    }
    if (
      (existingWaitingPatient.patientName === 'Anonymous Patient' || !existingWaitingPatient.patientName)
      && identity.patientName
      && identity.patientName !== 'Anonymous Patient'
    ) {
      patch.patientName = identity.patientName;
      patch.patientId = identity.patientId;
    }
    await db.collection('waitingPatients').doc(existingWaitingPatient.id).update(patch);

    return result(200, {
      success: true,
      liveKitToken: signLiveKitRoomToken({
        subject: `patient_${tokenPayload.invitationId}_${existingWaitingPatient.id}`,
        roomName: waitingRoomName,
        participantName: participantDisplayName,
        expiresIn: '1h',
      }),
      roomName: waitingRoomName,
      waitingRoomToken: true,
      waitingRoomEnabled: true,
      invitationId: tokenPayload.invitationId,
      waitingPatientId: existingWaitingPatient.id,
    });
  }

  const waitingPatientId = await reserveWaitingPatient(db, {
    invitationId: tokenPayload.invitationId,
    roomName: tokenPayload.roomName,
    doctorUserId,
    identity,
    status: 'waiting',
    clientIP,
    userAgent,
    admissionMode: 'doctor-manual',
    riskSignals,
    accessAttemptData,
  });
  if (!waitingPatientId) {
    return result(409, {
      success: false,
      error: 'This invitation is no longer available. Ask the doctor for a new link.',
    });
  }

  return result(200, {
    success: true,
    liveKitToken: signLiveKitRoomToken({
      subject: `patient_${tokenPayload.invitationId}_${waitingPatientId}`,
      roomName: waitingRoomName,
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
      context.authenticatedVisitor?.authenticatedEmail || undefined,
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

    const usageError = await validateUsageLimits(
      db,
      invitation,
      tokenPayload.invitationId,
      tokenPayload.roomName,
      isWaitingRoomEnabled
    );
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

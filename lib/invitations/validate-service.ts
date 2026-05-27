import { getFirebaseAdmin } from '../firebase-admin';
import {
  AccessAttempt,
  DeviceFingerprint,
  Invitation,
  InvitationToken,
  SecurityViolation,
  ValidateInvitationResponse,
  WaitingPatient,
} from '../types';
import { getGeolocationFromIP } from './geolocation-utils';
import { signLiveKitRoomToken, verifyInvitationToken } from './token-utils';
import { detectBrowser, generateDeviceFingerprintHash, toDate } from './utils';
import { buildWaitingPatientIdentity } from './waiting-patient-identity';
import { EVENT_DOMAINS, EVENT_SCHEMA_VERSION } from '../events/event-schema';
import { getInvitationEmailAllowlist, isEmailAllowedByInvitation } from './email-allowlist';
import { finalizeConsultationForRoom } from '../services/consultation-finalization';
import { UserRepository } from '../repositories/user-repository';

export interface ValidateInvitationContext {
  token: string;
  deviceFingerprint?: DeviceFingerprint;
  userEmail?: string;
  clientIP: string;
  userAgent: string;
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

interface WaitingPatientIdentity {
  patientId: string;
  patientName: string;
  patientEmail?: string;
  isAnonymous: boolean;
}

function result(status: number, body: ValidateInvitationResponse): ValidateInvitationResult {
  return { status, body };
}

function normalizeEmail(email?: string): string | undefined {
  return email ? email.toLowerCase().trim() : undefined;
}

function buildAccessAttempt(
  clientIP: string,
  userAgent: string,
  country?: string,
  deviceFingerprint?: DeviceFingerprint
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
    },
    timestamp: occurredAt,
    ip: clientIP,
    userAgent,
    country,
    deviceFingerprint: deviceFingerprint ? generateDeviceFingerprintHash(deviceFingerprint) : undefined,
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
    ip: accessAttempt.ip,
    userAgent: accessAttempt.userAgent,
    success: accessAttempt.success,
    reason: accessAttempt.reason,
    ...(accessAttempt.country && { country: accessAttempt.country }),
    ...(accessAttempt.deviceFingerprint && { deviceFingerprint: accessAttempt.deviceFingerprint }),
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
    ip: input.clientIP,
    userAgent: input.userAgent,
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

function isAutoAdmissionCandidate(invitation: Invitation, lookup: UserLookupContext): boolean {
  return Boolean(isEmailAllowedByInvitation(invitation, lookup.userEmailToCheck) && lookup.userDocId);
}

async function lookupRegisteredAdmissionHistory(
  db: any,
  invitationId: string,
  patientEmail: string
): Promise<{ hasLeft: boolean; latestAdmitted: WaitingPatient | null }> {
  const existingPatientsQuery = await db.collection('waitingPatients')
    .where('invitationId', '==', invitationId)
    .where('patientEmail', '==', patientEmail)
    .get();

  if (existingPatientsQuery.empty) {
    return { hasLeft: false, latestAdmitted: null };
  }

  let hasLeft = false;
  let latestAdmitted: WaitingPatient | null = null;
  let latestAdmittedTime = 0;

  existingPatientsQuery.docs.forEach((doc: any) => {
    const data = { id: doc.id, ...doc.data() } as WaitingPatient;

    if (data.status === 'left' || data.status === 'rejected') {
      hasLeft = true;
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

  return { hasLeft, latestAdmitted };
}

async function appendInvitationAccessAudit(
  db: any,
  invitationId: string,
  invitation: Invitation,
  accessAttemptData: Record<string, any>
): Promise<void> {
  await db.collection('invitations').doc(invitationId).update({
    currentUses: (invitation.currentUses || 0) + 1,
    'audit.accessAttempts': [...(invitation.audit?.accessAttempts || []), accessAttemptData],
    'audit.lastAccessed': new Date(),
  });
}

async function persistWaitingPatient(
  db: any,
  input: {
    invitationId: string;
    roomName: string;
    doctorUserId: string;
    identity: WaitingPatientIdentity;
    status: WaitingPatient['status'];
    clientIP: string;
    userAgent: string;
    deviceFingerprint?: DeviceFingerprint;
    admissionMode?: 'doctor-manual' | 'auto-email-match';
  }
): Promise<string> {
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
      ...(input.deviceFingerprint && { deviceFingerprint: JSON.stringify(input.deviceFingerprint) }),
      ip: input.clientIP,
      userAgent: input.userAgent,
      lastAccessed: now,
      ...(input.admissionMode && { admissionMode: input.admissionMode }),
      isAnonymous: input.identity.isAnonymous,
    },
  };

  if (input.status === 'admitted') {
    waitingPatient.admittedAt = now;
  }

  await db.collection('waitingPatients').doc(waitingPatientId).set(waitingPatient);
  return waitingPatientId;
}

async function resolveUserContext(
  db: any,
  invitation: Invitation,
  tokenPayload: InvitationToken,
  userEmail: string | undefined,
  clientIP: string,
  userAgent: string,
  violations: SecurityViolation[]
): Promise<{ lookup: UserLookupContext; earlyResult?: ValidateInvitationResult }> {
  const emailAllowlist = getInvitationEmailAllowlist(invitation);
  const defaultInvitationEmail = emailAllowlist[0];
  const lookup: UserLookupContext = {
    userEmailToCheck: normalizeEmail(userEmail || tokenPayload.email || defaultInvitationEmail),
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
        registeredEmail: defaultInvitationEmail || lookup.userEmailToCheck,
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
        error: 'Consent required. Please provide consent to store device information.',
        requiresRegistration: true,
        registeredEmail: defaultInvitationEmail || lookup.userEmailToCheck,
      }),
    };
  }

  if (emailAllowlist.length > 0 && !isEmailAllowedByInvitation(invitation, lookup.userEmailToCheck)) {
    violations.push(
      buildSecurityViolation({
        type: 'wrong_email',
        details: `Expected one of: ${emailAllowlist.join(', ')}, Got: ${lookup.userEmailToCheck}`,
        clientIP,
        userAgent,
        actorType: 'patient',
        actorId: lookup.userDocId || null,
      })
    );
  }

  return { lookup };
}

async function collectSecurityViolations(
  db: any,
  lookup: UserLookupContext,
  deviceFingerprint: DeviceFingerprint | undefined,
  isWaitingRoomEnabled: boolean,
  geolocation: any,
  detectedBrowser: string,
  clientIP: string,
  userAgent: string,
  violations: SecurityViolation[]
): Promise<void> {
  if (!lookup.userProfile) {
    return;
  }

  if (deviceFingerprint && lookup.userProfile.deviceInfo && !isWaitingRoomEnabled) {
    const currentDeviceHash = generateDeviceFingerprintHash(deviceFingerprint);
    if (lookup.userProfile.deviceInfo.deviceFingerprintHash !== currentDeviceHash) {
      violations.push(
        buildSecurityViolation({
          type: 'wrong_device',
          details: 'Device fingerprint does not match registered device',
          clientIP,
          userAgent,
          actorType: 'patient',
          actorId: lookup.userDocId || null,
        })
      );
    }
  } else if (deviceFingerprint && !lookup.userProfile.deviceInfo && lookup.userDocId) {
    const deviceHash = generateDeviceFingerprintHash(deviceFingerprint);
    await new UserRepository(db).update(lookup.userDocId, {
      'deviceInfo.deviceFingerprintHash': deviceHash,
      'deviceInfo.userAgent': deviceFingerprint.userAgent,
      'deviceInfo.platform': deviceFingerprint.platform,
      'deviceInfo.screenResolution': deviceFingerprint.screenResolution,
      'deviceInfo.timezone': deviceFingerprint.timezone,
      'browserInfo.name': detectedBrowser,
    });
  }

  if (geolocation && lookup.userProfile.locationInfo) {
    if (
      lookup.userProfile.locationInfo.country !== geolocation.country &&
      lookup.userProfile.locationInfo.countryCode !== geolocation.countryCode
    ) {
      violations.push(
        buildSecurityViolation({
          type: 'wrong_country',
          details:
            `Expected: ${lookup.userProfile.locationInfo.country} ` +
            `(${lookup.userProfile.locationInfo.countryCode}), Got: ${geolocation.country} (${geolocation.countryCode})`,
          clientIP,
          userAgent,
          actorType: 'patient',
          actorId: lookup.userDocId || null,
        })
      );
    }
  }

  if (lookup.userProfile.browserInfo && lookup.userProfile.browserInfo.name !== detectedBrowser) {
    violations.push(
      buildSecurityViolation({
        type: 'wrong_browser',
        details: `Expected: ${lookup.userProfile.browserInfo.name}, Got: ${detectedBrowser}`,
        clientIP,
        userAgent,
        actorType: 'patient',
        actorId: lookup.userDocId || null,
      })
    );
  }
}

async function denyWithViolations(
  db: any,
  invitationId: string,
  invitation: Invitation,
  accessAttempt: AccessAttempt,
  violations: SecurityViolation[]
): Promise<ValidateInvitationResult> {
  accessAttempt.reason = `Violations: ${violations.map((violation) => violation.type).join(', ')}`;
  const accessAttemptData = toAccessAttemptData(accessAttempt);

  await db.collection('invitations').doc(invitationId).update({
    'audit.accessAttempts': [...(invitation.audit?.accessAttempts || []), accessAttemptData],
    'audit.violations': [...(invitation.audit?.violations || []), ...violations],
    'audit.lastAccessed': new Date(),
  });

  return result(403, {
    success: false,
    error: 'Access denied due to security violations',
    violations,
  });
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
  deviceFingerprint: DeviceFingerprint | undefined,
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

    const sameNetworkIdentity =
      patient.metadata?.ip === clientIP &&
      patient.metadata?.userAgent === userAgent;
    if (!sameNetworkIdentity) {
      return false;
    }

    if (!deviceFingerprint) {
      return true;
    }

    const incomingFingerprint = JSON.stringify(deviceFingerprint);
    const storedFingerprint = patient.metadata?.deviceFingerprint;
    if (!storedFingerprint || typeof storedFingerprint !== 'string') {
      return true;
    }

    return storedFingerprint === incomingFingerprint;
  });

  return anonymousCandidate || null;
}

async function handleWaitingRoomAccess(params: {
  db: any;
  tokenPayload: InvitationToken;
  invitation: Invitation;
  lookup: UserLookupContext;
  explicitUserEmail?: string;
  accessAttemptData: Record<string, any>;
  participantDisplayName: string;
  waitingRoomName: string;
  clientIP: string;
  userAgent: string;
  deviceFingerprint?: DeviceFingerprint;
}): Promise<ValidateInvitationResult> {
  const {
    db,
    tokenPayload,
    invitation,
    lookup,
    explicitUserEmail,
    accessAttemptData,
    participantDisplayName,
    waitingRoomName,
    clientIP,
    userAgent,
    deviceFingerprint,
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
    invitationEmail: lookup.userEmailToCheck || getInvitationEmailAllowlist(invitation)[0],
    userDocId: lookup.userDocId,
  });

  if (isAutoAdmissionCandidate(invitation, lookup) && identity.patientEmail) {
    const admissionHistory = await lookupRegisteredAdmissionHistory(
      db,
      tokenPayload.invitationId,
      identity.patientEmail
    );

    if (!admissionHistory.hasLeft) {
      if (admissionHistory.latestAdmitted) {
        await appendInvitationAccessAudit(db, tokenPayload.invitationId, invitation, accessAttemptData);

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

      const admittedWaitingPatientId = await persistWaitingPatient(db, {
        invitationId: tokenPayload.invitationId,
        roomName: tokenPayload.roomName,
        doctorUserId,
        identity,
        status: 'admitted',
        clientIP,
        userAgent,
        deviceFingerprint,
        admissionMode: 'auto-email-match',
      });

      await appendInvitationAccessAudit(db, tokenPayload.invitationId, invitation, accessAttemptData);

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
  }

  const existingWaitingPatient = await findExistingWaitingPatient(
    db,
    tokenPayload.invitationId,
    identity,
    deviceFingerprint,
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

  const waitingPatientId = await persistWaitingPatient(db, {
    invitationId: tokenPayload.invitationId,
    roomName: tokenPayload.roomName,
    doctorUserId,
    identity,
    status: 'waiting',
    clientIP,
    userAgent,
    deviceFingerprint,
    admissionMode: 'doctor-manual',
  });

  await appendInvitationAccessAudit(db, tokenPayload.invitationId, invitation, accessAttemptData);

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

    const geolocation = await getGeolocationFromIP(context.clientIP);
    const detectedBrowser = detectBrowser(context.userAgent);
    const accessAttempt = buildAccessAttempt(
      context.clientIP,
      context.userAgent,
      geolocation?.country,
      context.deviceFingerprint
    );
    const violations: SecurityViolation[] = [];

    const userResolution = await resolveUserContext(
      db,
      invitation,
      tokenPayload,
      context.userEmail,
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

    await collectSecurityViolations(
      db,
      userResolution.lookup,
      context.deviceFingerprint,
      isWaitingRoomEnabled,
      geolocation,
      detectedBrowser,
      context.clientIP,
      context.userAgent,
      violations
    );

    console.log('Validation debug info:', {
      invitationId: tokenPayload.invitationId,
      userEmail: userResolution.lookup.userEmailToCheck || 'none (open invitation)',
      userRegistered: Boolean(userResolution.lookup.userProfile),
      consentGiven: userResolution.lookup.userProfile?.consentGiven || false,
      clientIP: context.clientIP,
      geolocation: geolocation
        ? { country: geolocation.country, countryCode: geolocation.countryCode }
        : null,
      detectedBrowser,
      userAgent: context.userAgent,
    });

    if (violations.length > 0) {
      return await denyWithViolations(db, tokenPayload.invitationId, invitation, accessAttempt, violations);
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
        accessAttemptData,
        participantDisplayName,
        waitingRoomName,
        clientIP: context.clientIP,
        userAgent: context.userAgent,
        deviceFingerprint: context.deviceFingerprint,
      });
    }

    const liveKitToken = signLiveKitRoomToken({
      subject: `patient_${tokenPayload.invitationId}_${Date.now()}`,
      roomName: tokenPayload.roomName,
      participantName: participantDisplayName,
      expiresIn: '1h',
    });

    await db.collection('invitations').doc(tokenPayload.invitationId).update({
      status: 'used',
      usedAt: new Date(),
      usedBy: context.clientIP,
      'audit.accessAttempts': [...(invitation.audit?.accessAttempts || []), accessAttemptData],
      'audit.lastAccessed': new Date(),
    });

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

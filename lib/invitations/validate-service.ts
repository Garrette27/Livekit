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
    eventVersion: EVENT_SCHEMA_VERSION,
    occurredAt,
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
    eventVersion: accessAttempt.eventVersion || EVENT_SCHEMA_VERSION,
    occurredAt: accessAttempt.occurredAt || accessAttempt.timestamp,
    timestamp: accessAttempt.timestamp,
    ip: accessAttempt.ip,
    userAgent: accessAttempt.userAgent,
    success: accessAttempt.success,
    reason: accessAttempt.reason,
    ...(accessAttempt.country && { country: accessAttempt.country }),
    ...(accessAttempt.deviceFingerprint && { deviceFingerprint: accessAttempt.deviceFingerprint }),
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

    if (data.status === 'left') {
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

  const userQuery = await db.collection('users')
    .where('email', '==', lookup.userEmailToCheck)
    .limit(1)
    .get();

  if (userQuery.empty) {
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

  lookup.userDocId = userQuery.docs[0].id;
  lookup.userProfile = userQuery.docs[0].data();

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
    const violationTimestamp = new Date() as any;
    violations.push({
      eventDomain: EVENT_DOMAINS.INVITATION_AUDIT,
      eventVersion: EVENT_SCHEMA_VERSION,
      occurredAt: violationTimestamp,
      timestamp: violationTimestamp,
      type: 'wrong_email',
      details: `Expected one of: ${emailAllowlist.join(', ')}, Got: ${lookup.userEmailToCheck}`,
      ip: clientIP,
      userAgent,
    });
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
      const violationTimestamp = new Date() as any;
      violations.push({
        eventDomain: EVENT_DOMAINS.INVITATION_AUDIT,
        eventVersion: EVENT_SCHEMA_VERSION,
        occurredAt: violationTimestamp,
        timestamp: violationTimestamp,
        type: 'wrong_device',
        details: 'Device fingerprint does not match registered device',
        ip: clientIP,
        userAgent,
      });
    }
  } else if (deviceFingerprint && !lookup.userProfile.deviceInfo && lookup.userDocId) {
    const deviceHash = generateDeviceFingerprintHash(deviceFingerprint);
    await db.collection('users').doc(lookup.userDocId).update({
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
      const violationTimestamp = new Date() as any;
      violations.push({
        eventDomain: EVENT_DOMAINS.INVITATION_AUDIT,
        eventVersion: EVENT_SCHEMA_VERSION,
        occurredAt: violationTimestamp,
        timestamp: violationTimestamp,
        type: 'wrong_country',
        details:
          `Expected: ${lookup.userProfile.locationInfo.country} ` +
          `(${lookup.userProfile.locationInfo.countryCode}), Got: ${geolocation.country} (${geolocation.countryCode})`,
        ip: clientIP,
        userAgent,
      });
    }
  }

  if (lookup.userProfile.browserInfo && lookup.userProfile.browserInfo.name !== detectedBrowser) {
    const violationTimestamp = new Date() as any;
    violations.push({
      eventDomain: EVENT_DOMAINS.INVITATION_AUDIT,
      eventVersion: EVENT_SCHEMA_VERSION,
      occurredAt: violationTimestamp,
      timestamp: violationTimestamp,
      type: 'wrong_browser',
      details: `Expected: ${lookup.userProfile.browserInfo.name}, Got: ${detectedBrowser}`,
      ip: clientIP,
      userAgent,
    });
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
  deviceFingerprint: DeviceFingerprint | undefined,
  clientIP: string,
  userAgent: string
): Promise<WaitingPatient | null> {
  const deviceFingerprintHash = deviceFingerprint?.hash
    || (deviceFingerprint ? JSON.stringify(deviceFingerprint).substring(0, 50) : null);

  const existingPatientsQuery = await db.collection('waitingPatients')
    .where('invitationId', '==', invitationId)
    .get();

  if (existingPatientsQuery.empty) {
    return null;
  }

  const waitingPatients: WaitingPatient[] = existingPatientsQuery.docs
    .map((doc: any) => ({ id: doc.id, ...doc.data() } as WaitingPatient))
    .filter((patient: WaitingPatient) => patient.status === 'waiting');

  let existingWaitingPatient: WaitingPatient | undefined;

  if (deviceFingerprintHash) {
    existingWaitingPatient = waitingPatients.find((patient: WaitingPatient) => {
      const fingerprint = patient.metadata?.deviceFingerprint;
      return typeof fingerprint === 'string'
        ? fingerprint.includes(deviceFingerprintHash.substring(0, 20))
        : false;
    });
  }

  if (!existingWaitingPatient) {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    existingWaitingPatient = waitingPatients.find((patient: WaitingPatient) => {
      const joinedTime = toMillis(patient.joinedAt);
      return patient.metadata?.ip === clientIP
        && patient.metadata?.userAgent === userAgent
        && joinedTime > fiveMinutesAgo;
    });
  }

  return existingWaitingPatient || null;
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
    if (invitation.status === 'expired' || new Date() > expiresAtDate) {
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

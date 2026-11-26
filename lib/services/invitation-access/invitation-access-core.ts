import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { validateInvitationAndIssueToken } from '@/lib/invitations/validate-service';
import type { WaitingPatient } from '@/lib/types';
import { isKnownUserId } from '@/lib/consultations/identity-utils';
import {
  DATABASE_UNAVAILABLE_CODE,
  DATABASE_UNAVAILABLE_MESSAGE,
  isDatabaseUnavailableError,
} from '@/lib/services/shared/database-availability';
import {
  FirestoreConsultationSessionCore,
  LiveKitRtcTransportAdapter,
} from '@/lib/services/video-chat';
import type { ConsultationSessionStore, RtcTransportAdapter } from '@/lib/services/video-chat/contracts';
import type {
  CheckAdmissionInput,
  CheckAdmissionResult,
  CreateWaitingEntryInput,
  InvitationAccessService,
  ListWaitingEntriesInput,
  ValidateInviteContext,
  ValidateInviteResult,
} from './contracts';

const ALLOWED_WAITING_STATUSES: WaitingPatient['status'][] = ['waiting', 'admitted', 'left', 'rejected'];
const MAX_ACTIVE_ENTRY_AGE_MS = 24 * 60 * 60 * 1000;

interface DateLike {
  toDate?: () => Date;
  toMillis?: () => number;
}

interface InvitationSnapshot {
  id: string;
  status: string;
  expiresAt: unknown;
  roomName?: string;
  waitingRoomEnabled?: boolean;
  createdBy?: string;
}

class InvitationAccessError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'InvitationAccessError';
  }
}

function assertKnownStatus(value: unknown): WaitingPatient['status'] {
  if (value === 'waiting' || value === 'admitted' || value === 'left' || value === 'rejected') {
    return value;
  }

  return 'waiting';
}

function toMillis(value: unknown): number {
  if (!value) {
    return 0;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const maybeDateLike = value as DateLike;
  if (typeof maybeDateLike.toMillis === 'function') {
    return maybeDateLike.toMillis();
  }
  if (typeof maybeDateLike.toDate === 'function') {
    return maybeDateLike.toDate().getTime();
  }

  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function normalizePatientEmail(email?: string): string | undefined {
  if (!email) {
    return undefined;
  }

  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function isWaitingRoomName(roomName: string): boolean {
  return roomName.trim().toLowerCase().endsWith('-waiting');
}

/** Tolerance between LiveKit's and Firestore's clocks when ordering a visit start. */
const VISIT_START_CLOCK_SKEW_MS = 5_000;

function buildParticipantIdentity(waitingPatient: WaitingPatient): string {
  return `patient_${waitingPatient.invitationId}_${waitingPatient.id}`;
}

/**
 * A queue entry is reused when a person returns, so the entry id alone does
 * not name one visit. Once an entry records its current visit, a patient
 * credential must carry that same visit: a credential from an earlier visit
 * (or one issued before visit binding, which carries none) is refused.
 * Entries without a recorded visit are legacy rows and stay accepted until
 * their next arrival assigns one.
 */
/**
 * The doctor acts on the visit they saw in the queue. If the entry has since
 * started a different visit (the person left and came back), the command is
 * refused so the doctor re-reads the queue instead of admitting or removing a
 * visit they never reviewed. Omitted by older clients; then not enforced.
 */
function assertDoctorActsOnShownVisit(waitingPatient: WaitingPatient, expectedVisitId?: string): void {
  if (expectedVisitId && waitingPatient.currentVisitId && waitingPatient.currentVisitId !== expectedVisitId) {
    throw new InvitationAccessError(409, 'visit_changed', 'This visitor started a new visit. Refresh the queue and review it again.');
  }
}

function assertCredentialNamesCurrentVisit(waitingPatient: WaitingPatient, credentialVisitId?: string): void {
  if (waitingPatient.currentVisitId && waitingPatient.currentVisitId !== credentialVisitId) {
    throw new InvitationAccessError(403, 'stale_visit', 'This link was opened for an earlier visit. Reopen the invitation to continue.');
  }
}

function normalizeKnownPatientUserId(value?: string): string | null {
  if (!value || !isKnownUserId(value)) {
    return null;
  }

  return value;
}

function isInvitationActive(invitation: InvitationSnapshot | undefined, nowMs: number): boolean {
  if (!invitation) {
    return false;
  }

  // A missing status is a legacy active invitation, as validation and the
  // reservation already treat it; otherwise it would be listed but unadmittable.
  const status = invitation.status?.trim().toLowerCase();
  if (status && status !== 'active') {
    return false;
  }

  if (invitation.waitingRoomEnabled !== true) {
    return false;
  }

  const expiresAtMs = toMillis(invitation.expiresAt);
  if (expiresAtMs <= 0) {
    return false;
  }

  return expiresAtMs > nowMs;
}

function matchesInvitationRoom(waitingPatient: WaitingPatient, invitation: InvitationSnapshot): boolean {
  if (!invitation.roomName) {
    return false;
  }

  return waitingPatient.roomName === invitation.roomName;
}

function hasValidJoinTimestamp(waitingPatient: WaitingPatient): boolean {
  return toMillis(waitingPatient.joinedAt) > 0;
}

function toEntryActivityMillis(waitingPatient: WaitingPatient): number {
  const metadata = (waitingPatient.metadata as Record<string, unknown> | undefined) || {};

  return Math.max(
    toMillis(waitingPatient.joinedAt),
    toMillis(waitingPatient.admittedAt),
    toMillis((waitingPatient as { leftAt?: unknown }).leftAt),
    toMillis(waitingPatient.rejectedAt),
    toMillis(metadata.lastAccessed)
  );
}

function sortWaitingByJoinedAt(waitingPatients: WaitingPatient[]): WaitingPatient[] {
  return [...waitingPatients].sort((left, right) => toMillis(left.joinedAt) - toMillis(right.joinedAt));
}

function filterByStatus(
  waitingPatients: WaitingPatient[],
  statuses?: Array<WaitingPatient['status']>
): WaitingPatient[] {
  if (!statuses || statuses.length === 0) {
    return waitingPatients;
  }

  const allowedSet = new Set(statuses);
  return waitingPatients.filter((waitingPatient) => allowedSet.has(assertKnownStatus(waitingPatient.status)));
}

function mapWaitingDocToModel(input: { id: string; data: Record<string, unknown> }): WaitingPatient {
  return {
    id: input.id,
    doctorUserId: typeof input.data.doctorUserId === 'string' ? input.data.doctorUserId : undefined,
    patientId: String(input.data.patientId || ''),
    patientName: (input.data.patientName as string | undefined) || undefined,
    patientEmail: (input.data.patientEmail as string | undefined) || undefined,
    roomName: String(input.data.roomName || ''),
    invitationId: String(input.data.invitationId || ''),
    joinedAt: input.data.joinedAt as WaitingPatient['joinedAt'],
    status: assertKnownStatus(input.data.status),
    admittedAt: input.data.admittedAt as WaitingPatient['admittedAt'],
    leftAt: (input.data as { leftAt?: WaitingPatient['leftAt'] }).leftAt,
    rejectedAt: input.data.rejectedAt as WaitingPatient['rejectedAt'],
    currentVisitId: typeof input.data.currentVisitId === 'string' ? input.data.currentVisitId : undefined,
    metadata: (input.data.metadata as WaitingPatient['metadata']) || undefined,
  };
}

function assertDoctorScope(waitingPatient: WaitingPatient, doctorUserId?: string): void {
  if (!doctorUserId) {
    return;
  }

  const ownerDoctorUserId =
    (waitingPatient as unknown as { doctorUserId?: string }).doctorUserId
    || (waitingPatient.metadata as { doctorUserId?: string } | undefined)?.doctorUserId
    || null;

  if (ownerDoctorUserId !== doctorUserId) {
    throw new InvitationAccessError(403, 'forbidden', 'Doctor is not authorized to manage this waiting entry');
  }
}

/**
 * Invitation and waiting-room domain service.
 * UI/API callers use this boundary instead of mutating Firestore directly.
 */
export class FirestoreInvitationAccessCore implements InvitationAccessService {
  constructor(
    private readonly db: Firestore,
    private readonly rtcAdapter: RtcTransportAdapter = new LiveKitRtcTransportAdapter(),
    private readonly sessionStore: Pick<ConsultationSessionStore, 'appendEvent'> = new FirestoreConsultationSessionCore(db)
  ) {}

  /** Re-read the reserved visit and its authority together before any admission grant. */
  private async readCurrentWaitingVisit(transaction: Transaction, waitingPatientId: string): Promise<WaitingPatient> {
    const row = await transaction.get(this.db.collection('waitingPatients').doc(waitingPatientId));
    if (!row.exists) {
      throw new InvitationAccessError(404, 'not_found', 'Waiting patient not found');
    }
    const patient = mapWaitingDocToModel({ id: row.id, data: row.data() as Record<string, unknown> });
    if (!patient.invitationId) {
      throw new InvitationAccessError(403, 'invalid_invitation', 'This visit has no valid invitation');
    }
    const document = await transaction.get(this.db.collection('invitations').doc(patient.invitationId));
    const invitation = document.exists
      ? { ...document.data(), id: document.id } as InvitationSnapshot
      : undefined;
    if (
      !isInvitationActive(invitation, Date.now())
      || !invitation
      || !matchesInvitationRoom(patient, invitation)
      || !invitation.createdBy
      || !hasValidJoinTimestamp(patient)
    ) {
      throw new InvitationAccessError(403, 'invitation_unavailable', 'This invitation is expired, revoked, or no longer available');
    }
    assertDoctorScope(patient, invitation.createdBy);
    return patient;
  }

  /** Only a currently admitted, reserved visit may receive consultation media grants. */
  private issueAdmissionToken(patient: WaitingPatient): string {
    return this.rtcAdapter.issueRoomToken({
      subject: buildParticipantIdentity(patient),
      visitId: patient.currentVisitId,
      patientUserId: patient.metadata?.isAnonymous === false
        && patient.metadata?.identitySource === 'registered-profile'
        ? patient.patientId
        : undefined,
      roomName: patient.roomName,
      participantName: patient.patientName || patient.patientEmail || 'Anonymous Patient',
      expiresIn: '2h',
    });
  }

  private async resolveConsultationSessionId(roomName: string): Promise<string | null> {
    const consultationDoc = await this.db.collection('consultations').doc(roomName).get();
    if (consultationDoc.exists) {
      const consultationSessionId = consultationDoc.data()?.consultationSessionId;
      if (typeof consultationSessionId === 'string' && consultationSessionId.trim()) {
        return consultationSessionId.trim();
      }
    }

    const activeSessionSnapshot = await this.db
      .collection('consultationSessions')
      .where('roomName', '==', roomName)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    if (activeSessionSnapshot.empty) {
      return null;
    }

    const activeSessionDoc = activeSessionSnapshot.docs[0];
    const data = activeSessionDoc.data() as Record<string, unknown>;
    const consultationSessionId =
      typeof data.consultationSessionId === 'string' && data.consultationSessionId.trim()
        ? data.consultationSessionId.trim()
        : activeSessionDoc.id;

    return consultationSessionId;
  }

  private async appendSessionModerationEvent(input: {
    roomName: string;
    waitingPatient: WaitingPatient;
    eventType: 'admitted_to_consultation' | 'patient_removed_by_doctor';
    doctorUserId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const consultationSessionId = await this.resolveConsultationSessionId(input.roomName);
    if (!consultationSessionId) {
      return;
    }

    await this.sessionStore.appendEvent({
      sessionId: consultationSessionId,
      roomName: input.roomName,
      doctorUserId: input.doctorUserId || null,
      patientUserId: normalizeKnownPatientUserId(input.waitingPatient.patientId),
      actorType: 'doctor',
      actorId: input.doctorUserId || null,
      eventType: input.eventType,
      metadata: {
        waitingPatientId: input.waitingPatient.id,
        patientEmail: input.waitingPatient.patientEmail || null,
        ...(input.metadata || {}),
      },
    });
  }

  private async loadInvitationsById(invitationIds: string[]): Promise<Map<string, InvitationSnapshot>> {
    const uniqueInvitationIds = new Set(invitationIds.filter((id) => id.trim() && !id.includes('/')));
    if (uniqueInvitationIds.size === 0) {
      return new Map();
    }

    const invitations = this.db.collection('invitations');
    const invitationDocs = await this.db.getAll(...Array.from(uniqueInvitationIds, (id) => invitations.doc(id)));

    const invitationsById = new Map<string, InvitationSnapshot>();
    invitationDocs.forEach((invitationDoc) => {
      if (!invitationDoc.exists) {
        return;
      }

      const invitationData = invitationDoc.data() as Record<string, unknown>;
      invitationsById.set(invitationDoc.id, {
        id: invitationDoc.id,
        status: typeof invitationData.status === 'string' ? invitationData.status : 'active',
        expiresAt: invitationData.expiresAt,
        roomName: typeof invitationData.roomName === 'string' ? invitationData.roomName : undefined,
        waitingRoomEnabled: invitationData.waitingRoomEnabled === true,
        createdBy: typeof invitationData.createdBy === 'string' ? invitationData.createdBy : undefined,
      });
    });

    return invitationsById;
  }

  /**
   * Check invitation authority only for recent queue candidates. Empty queues
   * need no invitation reads, and visits on the same invitation share one read.
   */
  private async filterActiveEntries(
    waitingPatients: WaitingPatient[],
    doctorUserId?: string
  ): Promise<WaitingPatient[]> {
    const nowMs = Date.now();
    const recentPatients = waitingPatients.filter((patient) =>
      hasValidJoinTimestamp(patient) && nowMs - toEntryActivityMillis(patient) <= MAX_ACTIVE_ENTRY_AGE_MS
    );
    const invitationsById = await this.loadInvitationsById(recentPatients.map((patient) => patient.invitationId));
    return recentPatients.filter((patient) => {
      const invitation = invitationsById.get(patient.invitationId);
      return invitation !== undefined
        && (!doctorUserId || invitation.createdBy === doctorUserId)
        && isInvitationActive(invitation, nowMs)
        && matchesInvitationRoom(patient, invitation);
    });
  }

  async validateInvite(input: ValidateInviteContext): Promise<ValidateInviteResult> {
    return validateInvitationAndIssueToken(input);
  }

  async createWaitingEntry(input: CreateWaitingEntryInput): Promise<{ waitingPatientId: string }> {
    if (!input.invitationId || !input.roomName || !input.patientId || !input.doctorUserId) {
      throw new InvitationAccessError(400, 'invalid_argument', 'Missing required waiting entry fields');
    }

    const waitingPatientId =
      input.waitingPatientId?.trim()
      || `waiting_${input.invitationId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const now = new Date();
    const status = input.status || 'waiting';

    await this.db.collection('waitingPatients').doc(waitingPatientId).set(
      {
        id: waitingPatientId,
        patientId: input.patientId,
        patientName: input.patientName || 'Anonymous Patient',
        ...(normalizePatientEmail(input.patientEmail) && {
          patientEmail: normalizePatientEmail(input.patientEmail),
        }),
        roomName: input.roomName,
        invitationId: input.invitationId,
        doctorUserId: input.doctorUserId,
        joinedAt: now,
        status,
        ...(status === 'admitted' && { admittedAt: now }),
        metadata: {
          ...(input.metadata || {}),
          doctorUserId: input.doctorUserId,
          lastAccessed: now,
        },
      },
      { merge: true }
    );

    return { waitingPatientId };
  }

  async listWaitingEntries(input: ListWaitingEntriesInput): Promise<WaitingPatient[]> {
    const statuses = (input.statuses || ['waiting']).filter((status) => ALLOWED_WAITING_STATUSES.includes(status));
    const singleStatus = statuses.length === 1 ? statuses[0] : null;
    const activeOnly = input.activeOnly === true;

    if (input.doctorUserId) {
      const baseQuery = this.db.collection('waitingPatients').where('doctorUserId', '==', input.doctorUserId);
      const snapshot = singleStatus
        ? await baseQuery.where('status', '==', singleStatus).get()
        : await baseQuery.get();

      const waitingPatients = snapshot.docs.map((doc) =>
        mapWaitingDocToModel({ id: doc.id, data: doc.data() as Record<string, unknown> })
      );
      const roomScoped = input.roomName
        ? waitingPatients.filter((waitingPatient) => waitingPatient.roomName === input.roomName)
        : waitingPatients;
      const statusScoped = filterByStatus(roomScoped, statuses);
      const activeScoped = activeOnly ? await this.filterActiveEntries(statusScoped, input.doctorUserId) : statusScoped;

      return sortWaitingByJoinedAt(activeScoped);
    }

    if (input.invitationId) {
      const baseQuery = this.db.collection('waitingPatients').where('invitationId', '==', input.invitationId);
      const snapshot = singleStatus
        ? await baseQuery.where('status', '==', singleStatus).get()
        : await baseQuery.get();

      const statusScoped = filterByStatus(
        snapshot.docs.map((doc) =>
          mapWaitingDocToModel({ id: doc.id, data: doc.data() as Record<string, unknown> })
        ),
        statuses
      );
      const activeScoped = activeOnly ? await this.filterActiveEntries(statusScoped) : statusScoped;
      return sortWaitingByJoinedAt(activeScoped);
    }

    if (input.roomName) {
      const invitationsSnapshot = await this.db
        .collection('invitations')
        .where('roomName', '==', input.roomName)
        .where('waitingRoomEnabled', '==', true)
        .limit(200)
        .get();

      const nowMs = Date.now();
      const invitationIds = invitationsSnapshot.docs
        .filter((doc) => {
          if (!activeOnly) {
            return true;
          }

          const invitationData = doc.data() as Record<string, unknown>;
          const invitation: InvitationSnapshot = {
            id: doc.id,
            status: typeof invitationData.status === 'string' ? invitationData.status : 'active',
            expiresAt: invitationData.expiresAt,
            roomName: typeof invitationData.roomName === 'string' ? invitationData.roomName : undefined,
            waitingRoomEnabled: invitationData.waitingRoomEnabled === true,
            createdBy: typeof invitationData.createdBy === 'string' ? invitationData.createdBy : undefined,
          };
          return isInvitationActive(invitation, nowMs);
        })
        .map((doc) => doc.id);
      if (invitationIds.length === 0) {
        return [];
      }

      const waitingSnapshots = await Promise.all(
        invitationIds.map((invitationId) =>
          this.db.collection('waitingPatients').where('invitationId', '==', invitationId).get()
        )
      );
      const waitingPatients = waitingSnapshots.flatMap((snapshot) =>
        snapshot.docs.map((doc) =>
          mapWaitingDocToModel({ id: doc.id, data: doc.data() as Record<string, unknown> })
        )
      );
      const statusScoped = filterByStatus(waitingPatients, statuses);
      const activeScoped = activeOnly ? await this.filterActiveEntries(statusScoped) : statusScoped;
      return sortWaitingByJoinedAt(activeScoped);
    }

    throw new InvitationAccessError(
      400,
      'invalid_argument',
      'Missing required parameter: roomName, invitationId, or doctorUserId'
    );
  }

  async checkAdmission(input: CheckAdmissionInput): Promise<CheckAdmissionResult> {
    const invitationId = input.invitationId?.trim();
    const waitingPatientId = input.waitingPatientId?.trim();

    if (!waitingPatientId || !input.credentialRoomName) {
      throw new InvitationAccessError(
        400,
        'invalid_argument',
        'A waiting entry and verified room credential are required'
      );
    }

    return this.db.runTransaction(async (transaction) => {
      const waitingPatient = await this.readCurrentWaitingVisit(transaction, waitingPatientId);
      if (
        (invitationId && waitingPatient.invitationId !== invitationId)
        || ![waitingPatient.roomName, `${waitingPatient.roomName}-waiting`].includes(input.credentialRoomName)
      ) {
        throw new InvitationAccessError(403, 'room_mismatch', 'Room credential does not match this visit');
      }
      assertCredentialNamesCurrentVisit(waitingPatient, input.credentialVisitId);

      if (waitingPatient.status === 'admitted') {
        return {
          success: true, admitted: true, status: 'admitted',
          waitingPatientId: waitingPatient.id,
          liveKitToken: this.issueAdmissionToken(waitingPatient),
          roomName: waitingPatient.roomName,
        };
      }

      if (waitingPatient.status === 'rejected') {
        return {
          success: true,
          admitted: false,
          status: 'rejected',
          waitingPatientId: waitingPatient.id,
          error: 'You were rejected by the doctor. Please request a new invite if needed.',
        };
      }

      if (waitingPatient.status === 'left') {
        return {
          success: true,
          admitted: false,
          status: 'left',
          waitingPatientId: waitingPatient.id,
          error: 'You left the waiting room. Please reopen the invitation link to rejoin.',
        };
      }

      return {
        success: true,
        admitted: false,
        status: 'waiting',
        waitingPatientId: waitingPatient.id,
      };
    });
  }

  async admitWaitingEntry(input: {
    waitingPatientId: string;
    roomName: string;
    doctorUserId?: string;
    expectedVisitId?: string;
  }): Promise<{ liveKitToken: string; roomName: string; waitingPatientId: string }> {
    if (!input.waitingPatientId || !input.roomName) {
      throw new InvitationAccessError(
        400,
        'invalid_argument',
        'Missing required fields: waitingPatientId and roomName are required'
      );
    }

    const { waitingPatient, alreadyAdmitted } = await this.db.runTransaction(async (transaction) => {
      const patient = await this.readCurrentWaitingVisit(transaction, input.waitingPatientId);
      assertDoctorScope(patient, input.doctorUserId);
      assertDoctorActsOnShownVisit(patient, input.expectedVisitId);
      if (patient.roomName !== input.roomName) {
        throw new InvitationAccessError(400, 'room_mismatch', 'Room name mismatch');
      }
      if (patient.status === 'admitted') {
        return { waitingPatient: patient, alreadyAdmitted: true };
      }
      if (patient.status !== 'waiting') {
        throw new InvitationAccessError(400, 'invalid_state', 'Patient is no longer waiting');
      }
      transaction.set(this.db.collection('waitingPatients').doc(patient.id), {
        status: 'admitted', admittedAt: new Date(),
        metadata: {
          ...(patient.metadata || {}), lastAccessed: new Date(), admissionMode: 'doctor-manual',
        },
      }, { merge: true });
      return { waitingPatient: patient, alreadyAdmitted: false };
    });

    if (alreadyAdmitted) {
      return {
        waitingPatientId: waitingPatient.id, roomName: waitingPatient.roomName,
        liveKitToken: this.issueAdmissionToken(waitingPatient),
      };
    }

    try {
      await this.appendSessionModerationEvent({
        roomName: waitingPatient.roomName,
        waitingPatient,
        eventType: 'admitted_to_consultation',
        doctorUserId: input.doctorUserId,
        metadata: {
          admissionMode: 'doctor-manual',
          source: 'invitation-access-core.admitWaitingEntry',
        },
      });
    } catch (eventError) {
      console.warn('Failed to append admitted_to_consultation event:', {
        waitingPatientId: waitingPatient.id,
        roomName: waitingPatient.roomName,
        error: (eventError as Error).message,
      });
    }

    return {
      waitingPatientId: waitingPatient.id,
      roomName: waitingPatient.roomName,
      liveKitToken: this.issueAdmissionToken(waitingPatient),
    };
  }

  async rejectWaitingEntry(input: {
    waitingPatientId: string;
    doctorUserId?: string;
    expectedVisitId?: string;
  }): Promise<{ waitingPatientId: string; status: 'rejected' }> {
    if (!input.waitingPatientId) {
      throw new InvitationAccessError(400, 'invalid_argument', 'waitingPatientId is required');
    }

    const waitingRef = this.db.collection('waitingPatients').doc(input.waitingPatientId);
    // Read and write in one transaction so a reload that starts a new visit at
    // the same moment cannot overwrite (or be overwritten by) the rejection.
    const outcome = await this.db.runTransaction(async (transaction) => {
      const waitingDoc = await transaction.get(waitingRef);
      if (!waitingDoc.exists) {
        return { waitingPatient: null, alreadyRejected: true };
      }
      const current = mapWaitingDocToModel({ id: waitingDoc.id, data: waitingDoc.data() as Record<string, unknown> });
      assertDoctorScope(current, input.doctorUserId);
      assertDoctorActsOnShownVisit(current, input.expectedVisitId);
      if (current.status === 'rejected') {
        return { waitingPatient: current, alreadyRejected: true };
      }
      transaction.set(waitingRef, {
        status: 'rejected',
        rejectedAt: new Date(),
        metadata: { ...(current.metadata || {}), lastAccessed: new Date(), rejectedByDoctor: true },
      }, { merge: true });
      return { waitingPatient: current, alreadyRejected: false };
    });
    const waitingPatient = outcome.waitingPatient;
    if (!waitingPatient || outcome.alreadyRejected) {
      return { waitingPatientId: input.waitingPatientId, status: 'rejected' };
    }

    const participantIdentity = buildParticipantIdentity(waitingPatient);
    const candidateRooms = new Set<string>([waitingPatient.roomName, `${waitingPatient.roomName}-waiting`]);
    await Promise.all(
      Array.from(candidateRooms).map((roomName) =>
        this.rtcAdapter.disconnectParticipant({
          roomName,
          participantIdentity,
        })
      )
    );

    // Queue rows are reusable and have no immutable encounter binding. Removal
    // disconnects this transport participant; scoped tracking/webhooks finalize
    // the encounter. Never close or reattribute the room's latest session here.

    return {
      waitingPatientId: waitingPatient.id,
      status: 'rejected',
    };
  }

  /**
   * Applies a participant-left webhook signal to a waiting entry with room-aware semantics.
   * Waiting-room departures after admission are treated as transition noise, not a true leave.
   */
  async handleParticipantLeftWebhook(input: {
    waitingPatientId: string;
    roomName: string;
    /** When the departing connection joined (LiveKit participant.joinedAt), if reported. */
    participantJoinedAt?: Date | null;
  }): Promise<{
    handled: boolean;
    reason:
      | 'waiting_entry_not_found'
      | 'waiting_entry_marked_left'
      | 'waiting_entry_marked_rejected'
      | 'waiting_entry_already_left'
      | 'waiting_entry_already_rejected'
      | 'waiting_room_departure_after_admission_ignored'
      | 'earlier_visit_departure_ignored'
      | 'participant_still_connected';
    status: 'left' | 'rejected' | null;
  }> {
    const waitingPatientId = input.waitingPatientId?.trim();
    if (!waitingPatientId) {
      throw new InvitationAccessError(400, 'invalid_argument', 'waitingPatientId is required');
    }

    const waitingRef = this.db.collection('waitingPatients').doc(waitingPatientId);
    const waitingDoc = await waitingRef.get();
    if (!waitingDoc.exists) {
      return {
        handled: false,
        reason: 'waiting_entry_not_found',
        status: null,
      };
    }

    const waitingPatient = mapWaitingDocToModel({
      id: waitingDoc.id,
      data: waitingDoc.data() as Record<string, unknown>,
    });
    if (waitingPatient.status === 'rejected') {
      return {
        handled: false,
        reason: 'waiting_entry_already_rejected',
        status: 'rejected',
      };
    }
    if (waitingPatient.status === 'left') {
      return {
        handled: false,
        reason: 'waiting_entry_already_left',
        status: 'left',
      };
    }

    if (isWaitingRoomName(input.roomName) && waitingPatient.status === 'admitted') {
      return {
        handled: false,
        reason: 'waiting_room_departure_after_admission_ignored',
        status: null,
      };
    }

    // A departure belongs to the connection that joined at participantJoinedAt.
    // If the entry's current visit began after that, the event is a late or
    // duplicate report about an earlier visit and must not close this one.
    const joinedAtMs = input.participantJoinedAt?.getTime() || 0;
    if (joinedAtMs > 0 && toMillis(waitingPatient.joinedAt) > joinedAtMs + VISIT_START_CLOCK_SKEW_MS) {
      return { handled: false, reason: 'earlier_visit_departure_ignored', status: null };
    }

    // The same identity may still be connected — e.g. the patient opened the
    // call on a second device, which replaced the first connection.
    const stillConnected = await this.rtcAdapter.isParticipantConnected?.({
      roomName: input.roomName,
      participantIdentity: buildParticipantIdentity(waitingPatient),
    }).catch(() => false);
    if (stillConnected) {
      return { handled: false, reason: 'participant_still_connected', status: null };
    }

    const result = await this.markWaitingEntryLeft({ waitingPatientId: waitingPatient.id });
    return {
      handled: true,
      reason: result.status === 'rejected' ? 'waiting_entry_marked_rejected' : 'waiting_entry_marked_left',
      status: result.status,
    };
  }

  async markWaitingEntryLeft(
    input: { waitingPatientId: string; credential?: { visitId?: string } }
  ): Promise<{ waitingPatientId: string; status: 'left' | 'rejected' }> {
    if (!input.waitingPatientId) {
      throw new InvitationAccessError(400, 'invalid_argument', 'waitingPatientId is required');
    }

    const waitingRef = this.db.collection('waitingPatients').doc(input.waitingPatientId);
    return this.db.runTransaction(async (transaction) => {
      const waitingDoc = await transaction.get(waitingRef);
      if (!waitingDoc.exists) {
        return { waitingPatientId: input.waitingPatientId, status: 'left' as const };
      }
      const waitingPatient = mapWaitingDocToModel({ id: waitingDoc.id, data: waitingDoc.data() as Record<string, unknown> });
      if (input.credential) {
        // A departure beacon from an earlier visit must not close a later one.
        assertCredentialNamesCurrentVisit(waitingPatient, input.credential.visitId);
      }
      if (waitingPatient.status === 'rejected' || waitingPatient.status === 'left') {
        return { waitingPatientId: waitingPatient.id, status: waitingPatient.status };
      }
      transaction.set(waitingRef, {
        status: 'left',
        leftAt: new Date(),
        metadata: { ...(waitingPatient.metadata || {}), lastAccessed: new Date() },
      }, { merge: true });
      return { waitingPatientId: waitingPatient.id, status: 'left' as const };
    });
    // The separate authenticated track-leave carries the encounter id; this
    // operational queue notification never touches a clinical visit.
  }
}

export function toInvitationAccessError(error: unknown): {
  status: number;
  code: string;
  message: string;
} {
  if (error instanceof InvitationAccessError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
    };
  }

  if (isDatabaseUnavailableError(error)) {
    return { status: 503, code: DATABASE_UNAVAILABLE_CODE, message: DATABASE_UNAVAILABLE_MESSAGE };
  }

  return {
    status: 500,
    code: 'internal_error',
    message: error instanceof Error ? error.message : 'Internal server error',
  };
}

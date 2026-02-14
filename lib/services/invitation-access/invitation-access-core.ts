import type { Firestore } from 'firebase-admin/firestore';
import { validateInvitationAndIssueToken } from '@/lib/invitations/validate-service';
import type { WaitingPatient } from '@/lib/types';
import { isKnownUserId } from '@/lib/consultations/identity-utils';
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

function toDate(value: unknown): Date | null {
  const millis = toMillis(value);
  if (millis <= 0) {
    return null;
  }

  return new Date(millis);
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

function buildParticipantIdentity(waitingPatient: WaitingPatient): string {
  return `patient_${waitingPatient.invitationId}_${waitingPatient.id}`;
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

  const status = invitation.status?.trim().toLowerCase();
  if (status !== 'active') {
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

  if (ownerDoctorUserId && ownerDoctorUserId !== doctorUserId) {
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
    private readonly sessionStore: Pick<ConsultationSessionStore, 'appendEvent' | 'closeSession'> = new FirestoreConsultationSessionCore(db)
  ) {}

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

  private async closeSessionAfterPatientTransition(input: {
    roomName: string;
    waitingPatient: WaitingPatient;
    doctorUserId?: string;
    eventType: 'left' | 'patient_removed_by_doctor';
    actorType: 'patient' | 'doctor';
    actorId?: string | null;
    finalizationReason: 'patient_left' | 'patient_removed_by_doctor';
    source: string;
    transitionMetadata?: Record<string, unknown>;
  }): Promise<boolean> {
    const consultationSessionId = await this.resolveConsultationSessionId(input.roomName);
    if (!consultationSessionId) {
      return false;
    }

    const sessionDoc = await this.db.collection('consultationSessions').doc(consultationSessionId).get();
    const sessionData = sessionDoc.exists ? (sessionDoc.data() as Record<string, unknown>) : {};
    const sessionMetadata = (sessionData.metadata as Record<string, unknown> | undefined) || {};
    const sessionStartedAt =
      toDate(sessionData.sessionStartedAt || sessionData.createdAt || sessionMetadata.sessionStartedAt) || new Date();
    const sessionEndedAt = new Date();
    const durationMinutes = Math.max(0, Math.round((sessionEndedAt.getTime() - sessionStartedAt.getTime()) / 60000));
    const normalizedPatientUserId = normalizeKnownPatientUserId(input.waitingPatient.patientId);

    await this.sessionStore.closeSession({
      sessionId: consultationSessionId,
      roomName: input.roomName,
      doctorUserId: input.doctorUserId || null,
      patientUserId: normalizedPatientUserId,
      sessionStartedAt,
      sessionEndedAt,
      eventType: input.eventType,
      actorType: input.actorType,
      actorId: input.actorId || null,
      metadata: {
        ...(input.transitionMetadata || {}),
        waitingPatientId: input.waitingPatient.id,
        patientEmail: input.waitingPatient.patientEmail || null,
        durationMinutes,
        source: input.source,
      },
    });

    const consultationRef = this.db.collection('consultations').doc(input.roomName);
    const consultationDoc = await consultationRef.get();
    const consultationData = consultationDoc.exists ? (consultationDoc.data() as Record<string, unknown>) : {};
    const consultationMetadata = (consultationData.metadata as Record<string, unknown> | undefined) || {};
    await consultationRef.set(
      {
        roomName: input.roomName,
        consultationSessionId,
        sessionStartedAt,
        leftAt: sessionEndedAt,
        duration: durationMinutes,
        status: 'completed',
        ...(normalizedPatientUserId ? { patientUserId: normalizedPatientUserId } : {}),
        ...(input.waitingPatient.patientEmail ? { patientEmail: input.waitingPatient.patientEmail } : {}),
        metadata: {
          ...consultationMetadata,
          source: input.source,
          trackedAt: sessionEndedAt,
          durationMinutes,
          finalizationReason: input.finalizationReason,
          ...(normalizedPatientUserId ? { patientUserId: normalizedPatientUserId } : {}),
          ...(input.waitingPatient.patientEmail ? { patientEmail: input.waitingPatient.patientEmail } : {}),
          ...(input.doctorUserId ? { doctorUserId: input.doctorUserId } : {}),
          consultationSessionId,
          ...(input.finalizationReason === 'patient_removed_by_doctor'
            ? { removedByDoctorAt: sessionEndedAt.toISOString() }
            : { patientLeftAt: sessionEndedAt.toISOString() }),
          ...(input.transitionMetadata || {}),
        },
      },
      { merge: true }
    );

    return true;
  }

  private async closeSessionAfterDoctorRemoval(input: {
    roomName: string;
    waitingPatient: WaitingPatient;
    doctorUserId?: string;
  }): Promise<boolean> {
    return this.closeSessionAfterPatientTransition({
      roomName: input.roomName,
      waitingPatient: input.waitingPatient,
      doctorUserId: input.doctorUserId,
      eventType: 'patient_removed_by_doctor',
      actorType: 'doctor',
      actorId: input.doctorUserId || null,
      finalizationReason: 'patient_removed_by_doctor',
      source: 'invitation-access-core.rejectWaitingEntry',
      transitionMetadata: {
        rejectionReason: 'doctor_moderation',
      },
    });
  }

  private async closeSessionAfterPatientLeft(input: {
    roomName: string;
    waitingPatient: WaitingPatient;
  }): Promise<boolean> {
    return this.closeSessionAfterPatientTransition({
      roomName: input.roomName,
      waitingPatient: input.waitingPatient,
      doctorUserId:
        (input.waitingPatient as unknown as { doctorUserId?: string }).doctorUserId
        || (input.waitingPatient.metadata as { doctorUserId?: string } | undefined)?.doctorUserId
        || undefined,
      eventType: 'left',
      actorType: 'patient',
      actorId: normalizeKnownPatientUserId(input.waitingPatient.patientId),
      finalizationReason: 'patient_left',
      source: 'invitation-access-core.markWaitingEntryLeft',
    });
  }

  private async loadInvitationsById(invitationIds: string[]): Promise<Map<string, InvitationSnapshot>> {
    if (invitationIds.length === 0) {
      return new Map();
    }

    const uniqueInvitationIds = Array.from(new Set(invitationIds.filter((invitationId) => invitationId.trim().length > 0)));
    const invitationDocs = await Promise.all(
      uniqueInvitationIds.map((invitationId) => this.db.collection('invitations').doc(invitationId).get())
    );

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
   * Returns invitation ids that are currently active for a doctor's waiting-room flow.
   * Keeping this list centralized prevents stale waiting entries from leaking into doctor queue views.
   */
  private async loadDoctorActiveInvitationIds(input: {
    doctorUserId: string;
    roomName?: string;
  }): Promise<Set<string>> {
    const invitationsSnapshot = await this.db
      .collection('invitations')
      .where('createdBy', '==', input.doctorUserId)
      .where('waitingRoomEnabled', '==', true)
      .limit(500)
      .get();

    const nowMs = Date.now();
    const activeInvitationIds = new Set<string>();

    invitationsSnapshot.docs.forEach((invitationDoc) => {
      const invitationData = invitationDoc.data() as Record<string, unknown>;
      const invitation: InvitationSnapshot = {
        id: invitationDoc.id,
        status: typeof invitationData.status === 'string' ? invitationData.status : 'active',
        expiresAt: invitationData.expiresAt,
        roomName: typeof invitationData.roomName === 'string' ? invitationData.roomName : undefined,
        waitingRoomEnabled: invitationData.waitingRoomEnabled === true,
        createdBy: typeof invitationData.createdBy === 'string' ? invitationData.createdBy : undefined,
      };

      if (!isInvitationActive(invitation, nowMs)) {
        return;
      }

      if (input.roomName && invitation.roomName !== input.roomName) {
        return;
      }

      activeInvitationIds.add(invitation.id);
    });

    return activeInvitationIds;
  }

  private async filterActiveEntries(waitingPatients: WaitingPatient[]): Promise<WaitingPatient[]> {
    if (waitingPatients.length === 0) {
      return waitingPatients;
    }

    const invitationsById = await this.loadInvitationsById(
      waitingPatients.map((waitingPatient) => waitingPatient.invitationId)
    );
    const nowMs = Date.now();

    return waitingPatients.filter((waitingPatient) => {
      const invitation = invitationsById.get(waitingPatient.invitationId);
      if (!invitation) {
        return false;
      }

      if (!isInvitationActive(invitation, nowMs)) {
        return false;
      }

      if (!matchesInvitationRoom(waitingPatient, invitation)) {
        return false;
      }

      if (!hasValidJoinTimestamp(waitingPatient)) {
        return false;
      }

      const activityMs = toEntryActivityMillis(waitingPatient);
      if (activityMs <= 0) {
        return false;
      }

      return nowMs - activityMs <= MAX_ACTIVE_ENTRY_AGE_MS;
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
      const activeInvitationIds = activeOnly
        ? await this.loadDoctorActiveInvitationIds({
            doctorUserId: input.doctorUserId,
            roomName: input.roomName,
          })
        : null;

      if (activeOnly && activeInvitationIds && activeInvitationIds.size === 0) {
        return [];
      }

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
      const invitationScoped =
        activeOnly && activeInvitationIds
          ? roomScoped.filter((waitingPatient) => activeInvitationIds.has(waitingPatient.invitationId))
          : roomScoped;
      const statusScoped = filterByStatus(invitationScoped, statuses);
      const activeScoped = activeOnly ? await this.filterActiveEntries(statusScoped) : statusScoped;

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
    const normalizedPatientEmail = normalizePatientEmail(input.patientEmail);

    if (!invitationId && !waitingPatientId) {
      throw new InvitationAccessError(
        400,
        'invalid_argument',
        'Missing required field: invitationId or waitingPatientId'
      );
    }

    const buildAdmittedResponse = (waitingPatient: WaitingPatient): CheckAdmissionResult => ({
      success: true,
      admitted: true,
      status: 'admitted',
      waitingPatientId: waitingPatient.id,
      liveKitToken: this.rtcAdapter.issueRoomToken({
        subject: buildParticipantIdentity(waitingPatient),
        roomName: waitingPatient.roomName,
        participantName: waitingPatient.patientName || waitingPatient.patientEmail || 'Anonymous Patient',
        expiresIn: '2h',
      }),
      roomName: waitingPatient.roomName,
    });

    if (waitingPatientId) {
      const waitingPatientDoc = await this.db.collection('waitingPatients').doc(waitingPatientId).get();
      if (!waitingPatientDoc.exists) {
        return {
          success: false,
          admitted: false,
          status: 'not_found',
          error: 'Waiting patient not found',
        };
      }

      const waitingPatient = mapWaitingDocToModel({
        id: waitingPatientDoc.id,
        data: waitingPatientDoc.data() as Record<string, unknown>,
      });

      if (invitationId && waitingPatient.invitationId !== invitationId) {
        return {
          success: false,
          admitted: false,
          status: 'not_found',
          error: 'Waiting patient invitation mismatch',
        };
      }

      if (waitingPatient.status === 'admitted') {
        return buildAdmittedResponse(waitingPatient);
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
    }

    const invitationSnapshot = await this.db
      .collection('waitingPatients')
      .where('invitationId', '==', invitationId as string)
      .get();
    const scopedPatients = invitationSnapshot.docs
      .map((doc) => mapWaitingDocToModel({ id: doc.id, data: doc.data() as Record<string, unknown> }))
      .filter((waitingPatient) => {
        if (!normalizedPatientEmail) {
          return true;
        }
        return normalizePatientEmail(waitingPatient.patientEmail) === normalizedPatientEmail;
      })
      .sort((left, right) => toMillis(right.joinedAt) - toMillis(left.joinedAt));

    const waitingEntry = scopedPatients.find((waitingPatient) => waitingPatient.status === 'waiting');
    if (waitingEntry) {
      return {
        success: true,
        admitted: false,
        status: 'waiting',
        waitingPatientId: waitingEntry.id,
      };
    }

    if (scopedPatients.length === 0) {
      return {
        success: true,
        admitted: false,
        status: 'not_found',
        error: 'No active waiting entry found for this visit. Please re-open the invitation link.',
      };
    }

    const latestEntry = scopedPatients[0];
    if (latestEntry.status === 'admitted') {
      return buildAdmittedResponse(latestEntry);
    }
    if (latestEntry.status === 'rejected' && normalizedPatientEmail) {
      return {
        success: true,
        admitted: false,
        status: 'rejected',
        waitingPatientId: latestEntry.id,
        error: 'You were rejected by the doctor. Please request a new invite if needed.',
      };
    }
    if (latestEntry.status === 'left' && normalizedPatientEmail) {
      return {
        success: true,
        admitted: false,
        status: 'left',
        waitingPatientId: latestEntry.id,
        error: 'You left the waiting room. Please reopen the invitation link to rejoin.',
      };
    }

    return {
      success: true,
      admitted: false,
      status: 'not_found',
      error: 'No active waiting entry found for this visit. Please re-open the invitation link.',
    };
  }

  async admitWaitingEntry(input: {
    waitingPatientId: string;
    roomName: string;
    doctorUserId?: string;
  }): Promise<{ liveKitToken: string; roomName: string; waitingPatientId: string }> {
    if (!input.waitingPatientId || !input.roomName) {
      throw new InvitationAccessError(
        400,
        'invalid_argument',
        'Missing required fields: waitingPatientId and roomName are required'
      );
    }

    const waitingDoc = await this.db.collection('waitingPatients').doc(input.waitingPatientId).get();
    if (!waitingDoc.exists) {
      throw new InvitationAccessError(404, 'not_found', 'Waiting patient not found');
    }

    const waitingPatient = mapWaitingDocToModel({
      id: waitingDoc.id,
      data: waitingDoc.data() as Record<string, unknown>,
    });
    assertDoctorScope(waitingPatient, input.doctorUserId);

    if (waitingPatient.roomName !== input.roomName) {
      throw new InvitationAccessError(400, 'room_mismatch', 'Room name mismatch');
    }

    if (waitingPatient.status === 'admitted') {
      return {
        waitingPatientId: waitingPatient.id,
        roomName: waitingPatient.roomName,
        liveKitToken: this.rtcAdapter.issueRoomToken({
          subject: buildParticipantIdentity(waitingPatient),
          roomName: waitingPatient.roomName,
          participantName: waitingPatient.patientName || waitingPatient.patientEmail || 'Anonymous Patient',
          expiresIn: '2h',
        }),
      };
    }

    if (waitingPatient.status !== 'waiting') {
      throw new InvitationAccessError(
        400,
        'invalid_state',
        `Patient is no longer waiting. Current status: ${waitingPatient.status}`
      );
    }

    await this.db.collection('waitingPatients').doc(waitingPatient.id).set(
      {
        status: 'admitted',
        admittedAt: new Date(),
        metadata: {
          ...(waitingPatient.metadata || {}),
          lastAccessed: new Date(),
          admissionMode: 'doctor-manual',
        },
      },
      { merge: true }
    );

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
      liveKitToken: this.rtcAdapter.issueRoomToken({
        subject: buildParticipantIdentity(waitingPatient),
        roomName: waitingPatient.roomName,
        participantName: waitingPatient.patientName || waitingPatient.patientEmail || 'Anonymous Patient',
        expiresIn: '2h',
      }),
    };
  }

  async rejectWaitingEntry(input: {
    waitingPatientId: string;
    doctorUserId?: string;
  }): Promise<{ waitingPatientId: string; status: 'rejected' }> {
    if (!input.waitingPatientId) {
      throw new InvitationAccessError(400, 'invalid_argument', 'waitingPatientId is required');
    }

    const waitingRef = this.db.collection('waitingPatients').doc(input.waitingPatientId);
    const waitingDoc = await waitingRef.get();
    if (!waitingDoc.exists) {
      return {
        waitingPatientId: input.waitingPatientId,
        status: 'rejected',
      };
    }

    const waitingPatient = mapWaitingDocToModel({
      id: waitingDoc.id,
      data: waitingDoc.data() as Record<string, unknown>,
    });
    assertDoctorScope(waitingPatient, input.doctorUserId);

    if (waitingPatient.status === 'rejected') {
      return {
        waitingPatientId: waitingPatient.id,
        status: 'rejected',
      };
    }

    const wasAdmitted = waitingPatient.status === 'admitted';

    await waitingRef.set(
      {
        status: 'rejected',
        rejectedAt: new Date(),
        metadata: {
          ...(waitingPatient.metadata || {}),
          lastAccessed: new Date(),
          rejectedByDoctor: true,
        },
      },
      { merge: true }
    );

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

    if (wasAdmitted) {
      let sessionClosed = false;
      try {
        sessionClosed = await this.closeSessionAfterDoctorRemoval({
          roomName: waitingPatient.roomName,
          waitingPatient,
          doctorUserId: input.doctorUserId,
        });
      } catch (eventError) {
        console.warn('Failed to close consultation session after patient removal:', {
          waitingPatientId: waitingPatient.id,
          roomName: waitingPatient.roomName,
          error: (eventError as Error).message,
        });
      }

      if (!sessionClosed) {
        try {
          await this.appendSessionModerationEvent({
            roomName: waitingPatient.roomName,
            waitingPatient,
            eventType: 'patient_removed_by_doctor',
            doctorUserId: input.doctorUserId,
            metadata: {
              source: 'invitation-access-core.rejectWaitingEntry',
              rejectionReason: 'doctor_moderation',
            },
          });
        } catch (eventError) {
          console.warn('Failed to append patient_removed_by_doctor event:', {
            waitingPatientId: waitingPatient.id,
            roomName: waitingPatient.roomName,
            error: (eventError as Error).message,
          });
        }
      }
    }

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
  }): Promise<{
    handled: boolean;
    reason:
      | 'waiting_entry_not_found'
      | 'waiting_entry_marked_left'
      | 'waiting_entry_marked_rejected'
      | 'waiting_entry_already_left'
      | 'waiting_entry_already_rejected'
      | 'waiting_room_departure_after_admission_ignored';
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

    const result = await this.markWaitingEntryLeft({ waitingPatientId: waitingPatient.id });
    return {
      handled: true,
      reason: result.status === 'rejected' ? 'waiting_entry_marked_rejected' : 'waiting_entry_marked_left',
      status: result.status,
    };
  }

  async markWaitingEntryLeft(
    input: { waitingPatientId: string }
  ): Promise<{ waitingPatientId: string; status: 'left' | 'rejected' }> {
    if (!input.waitingPatientId) {
      throw new InvitationAccessError(400, 'invalid_argument', 'waitingPatientId is required');
    }

    const waitingRef = this.db.collection('waitingPatients').doc(input.waitingPatientId);
    const waitingDoc = await waitingRef.get();
    if (!waitingDoc.exists) {
      return {
        waitingPatientId: input.waitingPatientId,
        status: 'left',
      };
    }

    const waitingPatient = mapWaitingDocToModel({
      id: waitingDoc.id,
      data: waitingDoc.data() as Record<string, unknown>,
    });
    if (waitingPatient.status === 'rejected') {
      return {
        waitingPatientId: waitingPatient.id,
        status: 'rejected',
      };
    }
    if (waitingPatient.status === 'left') {
      return {
        waitingPatientId: waitingPatient.id,
        status: 'left',
      };
    }

    const wasAdmitted = waitingPatient.status === 'admitted';

    await waitingRef.set(
      {
        status: 'left',
        leftAt: new Date(),
        metadata: {
          ...(waitingPatient.metadata || {}),
          lastAccessed: new Date(),
        },
      },
      { merge: true }
    );

    if (wasAdmitted) {
      try {
        await this.closeSessionAfterPatientLeft({
          roomName: waitingPatient.roomName,
          waitingPatient,
        });
      } catch (closeSessionError) {
        console.warn('Failed to close consultation session after patient left:', {
          waitingPatientId: waitingPatient.id,
          roomName: waitingPatient.roomName,
          error: (closeSessionError as Error).message,
        });
      }
    }

    return {
      waitingPatientId: waitingPatient.id,
      status: 'left',
    };
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

  return {
    status: 500,
    code: 'internal_error',
    message: error instanceof Error ? error.message : 'Internal server error',
  };
}

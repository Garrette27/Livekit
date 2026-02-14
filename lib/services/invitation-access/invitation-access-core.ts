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

interface DateLike {
  toDate?: () => Date;
  toMillis?: () => number;
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

function buildParticipantIdentity(waitingPatient: WaitingPatient): string {
  return `patient_${waitingPatient.invitationId}_${waitingPatient.id}`;
}

function normalizeKnownPatientUserId(value?: string): string | null {
  if (!value || !isKnownUserId(value)) {
    return null;
  }

  return value;
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
    private readonly sessionStore: Pick<ConsultationSessionStore, 'appendEvent'> = new FirestoreConsultationSessionCore(db)
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

      return sortWaitingByJoinedAt(filterByStatus(roomScoped, statuses));
    }

    if (input.invitationId) {
      const baseQuery = this.db.collection('waitingPatients').where('invitationId', '==', input.invitationId);
      const snapshot = singleStatus
        ? await baseQuery.where('status', '==', singleStatus).get()
        : await baseQuery.get();

      return sortWaitingByJoinedAt(
        filterByStatus(
          snapshot.docs.map((doc) =>
            mapWaitingDocToModel({ id: doc.id, data: doc.data() as Record<string, unknown> })
          ),
          statuses
        )
      );
    }

    if (input.roomName) {
      const invitationsSnapshot = await this.db
        .collection('invitations')
        .where('roomName', '==', input.roomName)
        .where('waitingRoomEnabled', '==', true)
        .limit(200)
        .get();

      const invitationIds = invitationsSnapshot.docs.map((doc) => doc.id);
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

      return sortWaitingByJoinedAt(filterByStatus(waitingPatients, statuses));
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
    if (latestEntry.status === 'rejected') {
      return {
        success: true,
        admitted: false,
        status: 'rejected',
        waitingPatientId: latestEntry.id,
        error: 'You were rejected by the doctor. Please request a new invite if needed.',
      };
    }
    if (latestEntry.status === 'left') {
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

    return {
      waitingPatientId: waitingPatient.id,
      status: 'rejected',
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

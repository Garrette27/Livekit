import type { Firestore } from 'firebase-admin/firestore';

interface DateLike {
  toDate?: () => Date;
  toMillis?: () => number;
}

type WaitingStatus = 'waiting' | 'admitted' | 'left' | 'rejected';

interface WaitingPatientDoc {
  id: string;
  roomName?: string;
  invitationId?: string;
  doctorUserId?: string;
  patientName?: string;
  patientEmail?: string;
  status?: string;
  joinedAt?: unknown;
  admittedAt?: unknown;
  leftAt?: unknown;
  rejectedAt?: unknown;
  metadata?: {
    isAnonymous?: boolean;
  };
}

export interface WaitingRoomParticipantHistory {
  waitingPatientId: string;
  invitationId: string | null;
  displayName: string;
  patientEmail: string | null;
  isAnonymous: boolean;
  status: WaitingStatus;
  joinedAt: string | null;
  admittedAt: string | null;
  leftAt: string | null;
  removedAt: string | null;
  waitingDurationMinutes: number | null;
}

export interface WaitingRoomHistorySnapshot {
  totalParticipants: number;
  registeredParticipantCount: number;
  anonymousParticipantCount: number;
  participantEmails: string[];
  participants: WaitingRoomParticipantHistory[];
}

interface BuildWaitingRoomHistoryInput {
  roomName: string;
  doctorUserId?: string | null;
  sessionStartedAt: Date;
  sessionEndedAt: Date;
}

function toDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  const maybeDateLike = value as DateLike;
  if (typeof maybeDateLike.toDate === 'function') {
    return maybeDateLike.toDate();
  }
  if (typeof maybeDateLike.toMillis === 'function') {
    return new Date(maybeDateLike.toMillis());
  }

  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toStatus(value: unknown): WaitingStatus {
  if (value === 'waiting' || value === 'admitted' || value === 'left' || value === 'rejected') {
    return value;
  }

  return 'waiting';
}

function normalizeEmail(value?: string): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function intersectsWindow(
  candidateTimes: Array<Date | null>,
  windowStart: Date,
  windowEnd: Date
): boolean {
  return candidateTimes.some((candidate) => {
    if (!candidate) {
      return false;
    }
    const millis = candidate.getTime();
    return millis >= windowStart.getTime() && millis <= windowEnd.getTime();
  });
}

function pickWaitingDurationEnd(
  joinedAt: Date | null,
  admittedAt: Date | null,
  leftAt: Date | null,
  removedAt: Date | null,
  sessionEndedAt: Date
): Date | null {
  if (!joinedAt) {
    return null;
  }

  const candidates = [admittedAt, leftAt, removedAt, sessionEndedAt]
    .filter((candidate): candidate is Date => Boolean(candidate))
    .filter((candidate) => candidate.getTime() >= joinedAt.getTime())
    .sort((left, right) => left.getTime() - right.getTime());

  return candidates[0] || null;
}

function toParticipantHistory(
  waitingPatient: WaitingPatientDoc,
  sessionEndedAt: Date
): WaitingRoomParticipantHistory | null {
  const status = toStatus(waitingPatient.status);
  const joinedAt = toDate(waitingPatient.joinedAt);
  const admittedAt = toDate(waitingPatient.admittedAt);
  const leftAt = toDate(waitingPatient.leftAt);
  const removedAt = toDate(waitingPatient.rejectedAt);
  const email = normalizeEmail(waitingPatient.patientEmail);
  const isAnonymous = !email;
  const displayName =
    (waitingPatient.patientName && waitingPatient.patientName.trim())
    || email
    || 'Anonymous Patient';

  const durationEnd = pickWaitingDurationEnd(joinedAt, admittedAt, leftAt, removedAt, sessionEndedAt);
  const waitingDurationMinutes =
    joinedAt && durationEnd
      ? Math.max(0, Math.round((durationEnd.getTime() - joinedAt.getTime()) / 60000))
      : null;

  const hasAnyTimestamp = Boolean(joinedAt || admittedAt || leftAt || removedAt);
  if (!hasAnyTimestamp) {
    return null;
  }

  return {
    waitingPatientId: waitingPatient.id,
    invitationId: waitingPatient.invitationId || null,
    displayName,
    patientEmail: email,
    isAnonymous,
    status,
    joinedAt: toIso(joinedAt),
    admittedAt: toIso(admittedAt),
    leftAt: toIso(leftAt),
    removedAt: toIso(removedAt),
    waitingDurationMinutes,
  };
}

/**
 * Build waiting-room participant history scoped to a single finalized consultation session.
 * The window intentionally includes pre-join waiting time so waiting metrics stay accurate.
 */
export async function buildWaitingRoomHistorySnapshot(
  db: Firestore,
  input: BuildWaitingRoomHistoryInput
): Promise<WaitingRoomHistorySnapshot> {
  const windowStart = new Date(input.sessionStartedAt.getTime() - (6 * 60 * 60 * 1000));
  const windowEnd = new Date(input.sessionEndedAt.getTime() + (30 * 60 * 1000));

  const snapshot = await db
    .collection('waitingPatients')
    .where('roomName', '==', input.roomName)
    .limit(500)
    .get();

  const participants = snapshot.docs
    .map((doc) => {
      const waitingPatientData = doc.data() as Omit<WaitingPatientDoc, 'id'>;
      return {
        ...waitingPatientData,
        id: doc.id,
      } as WaitingPatientDoc;
    })
    .filter((waitingPatient) => {
      if (input.doctorUserId && waitingPatient.doctorUserId && waitingPatient.doctorUserId !== input.doctorUserId) {
        return false;
      }

      const joinedAt = toDate(waitingPatient.joinedAt);
      const admittedAt = toDate(waitingPatient.admittedAt);
      const leftAt = toDate(waitingPatient.leftAt);
      const removedAt = toDate(waitingPatient.rejectedAt);

      return intersectsWindow([joinedAt, admittedAt, leftAt, removedAt], windowStart, windowEnd);
    })
    .map((waitingPatient) => toParticipantHistory(waitingPatient, input.sessionEndedAt))
    .filter((participant): participant is WaitingRoomParticipantHistory => Boolean(participant))
    .sort((left, right) => {
      const leftJoinedMs = left.joinedAt ? Date.parse(left.joinedAt) : 0;
      const rightJoinedMs = right.joinedAt ? Date.parse(right.joinedAt) : 0;
      return leftJoinedMs - rightJoinedMs;
    });

  const participantEmails = Array.from(
    new Set(
      participants
        .map((participant) => participant.patientEmail)
        .filter((patientEmail): patientEmail is string => Boolean(patientEmail))
    )
  );

  const anonymousParticipantCount = participants.filter((participant) => participant.isAnonymous).length;
  const registeredParticipantCount = participants.length - anonymousParticipantCount;

  return {
    totalParticipants: participants.length,
    registeredParticipantCount,
    anonymousParticipantCount,
    participantEmails,
    participants,
  };
}

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
  consultationSessionId?: string | null;
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

interface SessionWindowCandidate {
  consultationSessionId: string;
  sessionEndedAt: Date | null;
}

function normalizeConsultationSessionId(
  sessionDocId: string,
  sessionData: Record<string, unknown>
): string {
  const sessionIdFromData = sessionData.consultationSessionId;
  if (typeof sessionIdFromData === 'string' && sessionIdFromData.trim()) {
    return sessionIdFromData.trim();
  }

  return sessionDocId;
}

function resolveSessionEndedAt(sessionData: Record<string, unknown>): Date | null {
  const metadata = (sessionData.metadata as Record<string, unknown> | undefined) || {};
  return toDate(sessionData.sessionEndedAt || metadata.sessionEndedAt || sessionData.updatedAt);
}

function extractWaitingPatientIdFromEvent(eventData: Record<string, unknown>): string | null {
  const metadata = (eventData.metadata as Record<string, unknown> | undefined) || {};
  const waitingPatientId = metadata.waitingPatientId;
  if (typeof waitingPatientId !== 'string') {
    return null;
  }

  const normalized = waitingPatientId.trim();
  return normalized.startsWith('waiting_') ? normalized : null;
}

/**
 * Session events carry waitingPatientId for moderation and close actions.
 * Reusing room names is safe once history reads are anchored to those ids.
 */
async function resolveSessionScopedWaitingPatientIds(
  db: Firestore,
  consultationSessionId?: string | null
): Promise<Set<string>> {
  if (!consultationSessionId) {
    return new Set<string>();
  }

  try {
    const eventsSnapshot = await db
      .collection('consultationSessions')
      .doc(consultationSessionId)
      .collection('events')
      .limit(500)
      .get();

    const waitingPatientIds = new Set<string>();
    eventsSnapshot.docs.forEach((eventDoc) => {
      const waitingPatientId = extractWaitingPatientIdFromEvent(eventDoc.data() as Record<string, unknown>);
      if (waitingPatientId) {
        waitingPatientIds.add(waitingPatientId);
      }
    });

    return waitingPatientIds;
  } catch (error) {
    console.warn('Failed to resolve session-scoped waiting patient ids:', error);
    return new Set<string>();
  }
}

/**
 * Reused room names can contain waiting entries from older encounters.
 * The previous session end acts as a hard floor so one summary cannot absorb prior sessions.
 */
async function resolveWindowStart(
  db: Firestore,
  input: {
    roomName: string;
    consultationSessionId?: string | null;
    sessionStartedAt: Date;
  }
): Promise<Date> {
  const defaultWindowStart = new Date(input.sessionStartedAt.getTime() - (6 * 60 * 60 * 1000));
  if (!input.consultationSessionId) {
    return defaultWindowStart;
  }

  try {
    const sessionSnapshot = await db
      .collection('consultationSessions')
      .where('roomName', '==', input.roomName)
      .limit(300)
      .get();

    const previousSession = sessionSnapshot.docs
      .map((sessionDoc) => {
        const sessionData = sessionDoc.data() as Record<string, unknown>;
        return {
          consultationSessionId: normalizeConsultationSessionId(sessionDoc.id, sessionData),
          sessionEndedAt: resolveSessionEndedAt(sessionData),
        } as SessionWindowCandidate;
      })
      .filter((candidate) =>
        candidate.consultationSessionId !== input.consultationSessionId
        && Boolean(candidate.sessionEndedAt)
        && (candidate.sessionEndedAt as Date).getTime() <= input.sessionStartedAt.getTime()
      )
      .sort((left, right) =>
        (right.sessionEndedAt as Date).getTime() - (left.sessionEndedAt as Date).getTime()
      )[0];

    if (!previousSession?.sessionEndedAt) {
      return defaultWindowStart;
    }

    return new Date(
      Math.max(defaultWindowStart.getTime(), previousSession.sessionEndedAt.getTime() + 1)
    );
  } catch (error) {
    console.warn('Failed to resolve waiting-room history window start:', error);
    return defaultWindowStart;
  }
}

/**
 * Build waiting-room participant history scoped to a single finalized consultation session.
 * The window intentionally includes pre-join waiting time so waiting metrics stay accurate.
 */
export async function buildWaitingRoomHistorySnapshot(
  db: Firestore,
  input: BuildWaitingRoomHistoryInput
): Promise<WaitingRoomHistorySnapshot> {
  const windowStart = await resolveWindowStart(db, {
    roomName: input.roomName,
    consultationSessionId: input.consultationSessionId || null,
    sessionStartedAt: input.sessionStartedAt,
  });
  const windowEnd = new Date(input.sessionEndedAt.getTime() + (30 * 60 * 1000));
  const sessionScopedWaitingPatientIds = await resolveSessionScopedWaitingPatientIds(
    db,
    input.consultationSessionId || null
  );

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

      if (sessionScopedWaitingPatientIds.size > 0) {
        return sessionScopedWaitingPatientIds.has(waitingPatient.id);
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

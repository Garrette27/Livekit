import type { Firestore } from 'firebase-admin/firestore';
import { calculateDurationMinutes } from './session-timing';
import { generateAndStoreConsultationSummary } from './summary-service';
import {
  buildWaitingRoomHistorySnapshot,
  type WaitingRoomHistorySnapshot,
} from './waiting-room-history';

type FinalizationReason = 'doctor_left' | 'invitation_revoked' | 'invitation_expired';

interface FinalizeConsultationInput {
  roomName: string;
  finalizedAt: Date;
  reason: FinalizationReason;
  regenerateSummary?: boolean;
}

interface FinalizationResult {
  consultationSessionId: string;
  finalDurationMinutes: number;
}

function toDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }

  if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return new Date((value as { toMillis: () => number }).toMillis());
  }

  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDuration(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed);
}

function pickSessionDocument(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const sortedByStart = [...docs].sort((left, right) => {
    const leftStartedAt = toDate(left.data.sessionStartedAt || left.data.createdAt)?.getTime() || 0;
    const rightStartedAt = toDate(right.data.sessionStartedAt || right.data.createdAt)?.getTime() || 0;
    return rightStartedAt - leftStartedAt;
  });

  return sortedByStart.find((candidate) => candidate.data.status === 'active') || sortedByStart[0] || null;
}

function hasActiveDoctorInPresence(
  activeDoctors: Record<string, Record<string, unknown> | undefined>,
  doctorUserId?: string | null
): boolean {
  if (doctorUserId && activeDoctors[doctorUserId]?.joinedAt) {
    return true;
  }

  return Object.values(activeDoctors).some((doctorPresence) => Boolean(doctorPresence?.joinedAt));
}

async function resolveEffectiveSessionEndedAt(
  db: Firestore,
  input: {
    roomName: string;
    reason: FinalizationReason;
    finalizedAt: Date;
    sessionData: Record<string, unknown>;
  }
): Promise<Date> {
  if (input.reason === 'doctor_left') {
    return input.finalizedAt;
  }

  const sessionMetadata = (input.sessionData.metadata as Record<string, unknown> | undefined) || {};
  const lastDoctorLeftAt = toDate(sessionMetadata.lastDoctorLeftAt);
  if (!lastDoctorLeftAt || lastDoctorLeftAt.getTime() > input.finalizedAt.getTime()) {
    return input.finalizedAt;
  }

  if (input.reason === 'invitation_expired') {
    return lastDoctorLeftAt;
  }

  if (input.reason !== 'invitation_revoked') {
    return input.finalizedAt;
  }

  try {
    const presenceDoc = await db.collection('roomDoctorPresence').doc(input.roomName).get();
    if (!presenceDoc.exists) {
      return lastDoctorLeftAt;
    }

    const presenceData = presenceDoc.data() as Record<string, unknown>;
    const activeDoctors =
      (presenceData.activeDoctors as Record<string, Record<string, unknown> | undefined> | undefined) || {};
    const doctorUserId =
      typeof input.sessionData.doctorUserId === 'string' ? input.sessionData.doctorUserId : null;

    return hasActiveDoctorInPresence(activeDoctors, doctorUserId)
      ? input.finalizedAt
      : lastDoctorLeftAt;
  } catch (presenceLookupError) {
    console.warn('Failed to resolve active doctor presence during finalization:', presenceLookupError);
    return input.finalizedAt;
  }
}

async function applyFinalizationToSummary(
  db: Firestore,
  input: {
    consultationSessionId: string;
    finalDurationMinutes: number;
    sessionStartedAt: Date;
    sessionEndedAt: Date;
    finalizedAt: Date;
    reason: FinalizationReason;
    waitingRoomHistory: WaitingRoomHistorySnapshot;
  }
): Promise<void> {
  const summaryRef = db.collection('call-summaries').doc(input.consultationSessionId);
  const summaryDoc = await summaryRef.get();
  if (!summaryDoc.exists) {
    return;
  }

  const summaryData = summaryDoc.data() as Record<string, unknown>;
  const summaryMetadata = (summaryData.metadata as Record<string, unknown> | undefined) || {};
  await summaryRef.set(
    {
      duration: Math.max(parseDuration(summaryData.duration), input.finalDurationMinutes),
      startedAt: input.sessionStartedAt,
      endedAt: input.sessionEndedAt,
      metadata: {
        ...summaryMetadata,
        sessionStartedAt: input.sessionStartedAt.toISOString(),
        durationMinutes: input.finalDurationMinutes,
        finalDurationMinutes: input.finalDurationMinutes,
        sessionEndedAt: input.sessionEndedAt.toISOString(),
        finalizedAt: input.finalizedAt.toISOString(),
        finalizationReason: input.reason,
        durationSource: 'session_finalization',
        waitingRoomHistory: input.waitingRoomHistory,
      },
      updatedAt: new Date(),
    },
    { merge: true }
  );
}

export async function finalizeConsultationForRoom(
  db: Firestore,
  {
    roomName,
    finalizedAt,
    reason,
    regenerateSummary = true,
  }: FinalizeConsultationInput
): Promise<FinalizationResult | null> {
  const snapshot = await db
    .collection('consultationSessions')
    .where('roomName', '==', roomName)
    .limit(50)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const sessionCandidates = snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as Record<string, unknown>,
  }));
  const selectedSession = pickSessionDocument(sessionCandidates);
  if (!selectedSession) {
    return null;
  }

  const consultationSessionId =
    typeof selectedSession.data.consultationSessionId === 'string' &&
    selectedSession.data.consultationSessionId.trim()
      ? selectedSession.data.consultationSessionId.trim()
      : selectedSession.id;
  const sessionRef = db.collection('consultationSessions').doc(consultationSessionId);
  const sessionDoc = await sessionRef.get();
  const sessionData = (sessionDoc.exists ? sessionDoc.data() : selectedSession.data) as Record<string, unknown>;
  const sessionMetadata = (sessionData.metadata as Record<string, unknown> | undefined) || {};
  const effectiveSessionEndedAt = await resolveEffectiveSessionEndedAt(db, {
    roomName,
    reason,
    finalizedAt,
    sessionData,
  });

  const sessionStartedAt =
    toDate(sessionData.sessionStartedAt || sessionData.createdAt || sessionData.updatedAt) || finalizedAt;
  const durationFromClock = calculateDurationMinutes({
    startedAt: sessionStartedAt,
    endedAt: effectiveSessionEndedAt,
  });
  const finalDurationMinutes = Math.max(
    durationFromClock,
    parseDuration(sessionData.duration),
    parseDuration(sessionMetadata.durationMinutes),
    parseDuration(sessionMetadata.doctorDurationMinutes),
    parseDuration(sessionMetadata.finalDurationMinutes)
  );
  const doctorUserId =
    (sessionData.doctorUserId as string | undefined)
    || (typeof sessionMetadata.createdBy === 'string' ? sessionMetadata.createdBy : undefined)
    || null;
  const waitingRoomHistory = await buildWaitingRoomHistorySnapshot(db, {
    roomName,
    doctorUserId,
    sessionStartedAt,
    sessionEndedAt: effectiveSessionEndedAt,
  });
  const fallbackPatientEmail = waitingRoomHistory.participantEmails[0] || null;
  const sessionPatientEmail =
    (sessionData.patientEmail as string | undefined)
    || (typeof sessionMetadata.patientEmail === 'string' ? sessionMetadata.patientEmail : null)
    || fallbackPatientEmail;

  await sessionRef.set(
    {
      consultationSessionId,
      roomName,
      ...(doctorUserId ? { doctorUserId } : {}),
      status: 'completed',
      sessionStartedAt,
      sessionEndedAt: effectiveSessionEndedAt,
      duration: finalDurationMinutes,
      ...(sessionPatientEmail ? { patientEmail: sessionPatientEmail } : {}),
      metadata: {
        ...sessionMetadata,
        durationMinutes: finalDurationMinutes,
        finalDurationMinutes: finalDurationMinutes,
        sessionEndedAt: effectiveSessionEndedAt.toISOString(),
        finalizedAt: finalizedAt.toISOString(),
        finalizationReason: reason,
        waitingRoomHistory,
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    },
    { merge: true }
  );

  const consultationRef = db.collection('consultations').doc(roomName);
  const consultationDoc = await consultationRef.get();
  const consultationData = (consultationDoc.exists ? consultationDoc.data() : {}) as Record<string, unknown>;
  const consultationMetadata = (consultationData.metadata as Record<string, unknown> | undefined) || {};
  const consultationPatientEmail =
    (consultationData.patientEmail as string | undefined)
    || (typeof consultationMetadata.patientEmail === 'string' ? consultationMetadata.patientEmail : null)
    || sessionPatientEmail;
  await consultationRef.set(
    {
      roomName,
      consultationSessionId,
      sessionStartedAt,
      leftAt: effectiveSessionEndedAt,
      duration: finalDurationMinutes,
      status: 'completed',
      ...(consultationPatientEmail ? { patientEmail: consultationPatientEmail } : {}),
      metadata: {
        ...consultationMetadata,
        durationMinutes: finalDurationMinutes,
        finalDurationMinutes: finalDurationMinutes,
        sessionEndedAt: effectiveSessionEndedAt.toISOString(),
        finalizedAt: finalizedAt.toISOString(),
        finalizationReason: reason,
        waitingRoomHistory,
      },
    },
    { merge: true }
  );

  if (regenerateSummary) {
    const summaryDoctorUserId =
      doctorUserId ||
      (consultationData.createdBy as string | undefined) ||
      (consultationMetadata.createdBy as string | undefined);
    if (summaryDoctorUserId) {
      const patientName =
        (consultationData.patientName as string | undefined) ||
        ((sessionMetadata.patientName as string | undefined) || 'Patient');
      const patientUserId =
        (sessionData.patientUserId as string | undefined) ||
        (consultationData.patientUserId as string | undefined) ||
        (consultationMetadata.patientUserId as string | undefined) ||
        null;

      await generateAndStoreConsultationSummary({
        roomName,
        patientName,
        durationMinutes: finalDurationMinutes,
        userId: summaryDoctorUserId,
        consultationSessionId,
        patientUserId,
        patientEmail: consultationPatientEmail,
      });
    }
  }

  await applyFinalizationToSummary(db, {
    consultationSessionId,
    finalDurationMinutes,
    sessionStartedAt,
    sessionEndedAt: effectiveSessionEndedAt,
    finalizedAt,
    reason,
    waitingRoomHistory,
  });

  return {
    consultationSessionId,
    finalDurationMinutes,
  };
}

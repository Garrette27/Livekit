import type { Firestore } from 'firebase-admin/firestore';
import { calculateDurationMinutes } from './session-timing';
import { generateAndStoreConsultationSummary } from './summary-service';

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

  const sessionStartedAt =
    toDate(sessionData.sessionStartedAt || sessionData.createdAt || sessionData.updatedAt) || finalizedAt;
  const durationFromClock = calculateDurationMinutes({
    startedAt: sessionStartedAt,
    endedAt: finalizedAt,
  });
  const finalDurationMinutes = Math.max(
    durationFromClock,
    parseDuration(sessionData.duration),
    parseDuration(sessionMetadata.durationMinutes),
    parseDuration(sessionMetadata.doctorDurationMinutes),
    parseDuration(sessionMetadata.finalDurationMinutes)
  );

  await sessionRef.set(
    {
      consultationSessionId,
      roomName,
      status: 'completed',
      sessionStartedAt,
      sessionEndedAt: finalizedAt,
      duration: finalDurationMinutes,
      metadata: {
        ...sessionMetadata,
        durationMinutes: finalDurationMinutes,
        finalDurationMinutes: finalDurationMinutes,
        finalizedAt: finalizedAt.toISOString(),
        finalizationReason: reason,
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
  await consultationRef.set(
    {
      roomName,
      consultationSessionId,
      sessionStartedAt,
      leftAt: finalizedAt,
      duration: finalDurationMinutes,
      status: 'completed',
      metadata: {
        ...consultationMetadata,
        durationMinutes: finalDurationMinutes,
        finalDurationMinutes: finalDurationMinutes,
        finalizedAt: finalizedAt.toISOString(),
        finalizationReason: reason,
      },
    },
    { merge: true }
  );

  const summaryRef = db.collection('call-summaries').doc(consultationSessionId);
  const summaryDoc = await summaryRef.get();
  if (summaryDoc.exists) {
    const summaryData = summaryDoc.data() as Record<string, unknown>;
    const summaryMetadata = (summaryData.metadata as Record<string, unknown> | undefined) || {};
    await summaryRef.set(
      {
        duration: Math.max(parseDuration(summaryData.duration), finalDurationMinutes),
        metadata: {
          ...summaryMetadata,
          durationMinutes: finalDurationMinutes,
          finalDurationMinutes: finalDurationMinutes,
          finalizedAt: finalizedAt.toISOString(),
          finalizationReason: reason,
          durationSource: 'session_finalization',
        },
        updatedAt: new Date(),
      },
      { merge: true }
    );
  }

  if (regenerateSummary) {
    const doctorUserId =
      (sessionData.doctorUserId as string | undefined) ||
      (consultationData.createdBy as string | undefined) ||
      (consultationMetadata.createdBy as string | undefined);
    if (doctorUserId) {
      const patientName =
        (consultationData.patientName as string | undefined) ||
        ((sessionMetadata.patientName as string | undefined) || 'Patient');
      const patientUserId =
        (sessionData.patientUserId as string | undefined) ||
        (consultationData.patientUserId as string | undefined) ||
        (consultationMetadata.patientUserId as string | undefined) ||
        null;
      const patientEmail =
        (sessionData.patientEmail as string | undefined) ||
        (consultationData.patientEmail as string | undefined) ||
        (consultationMetadata.patientEmail as string | undefined) ||
        null;

      await generateAndStoreConsultationSummary({
        roomName,
        patientName,
        durationMinutes: finalDurationMinutes,
        userId: doctorUserId,
        consultationSessionId,
        patientUserId,
        patientEmail,
      });
    }
  }

  return {
    consultationSessionId,
    finalDurationMinutes,
  };
}

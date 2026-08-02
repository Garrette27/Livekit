import type { Firestore } from 'firebase-admin/firestore';
import { calculateDurationMinutes } from '@/lib/consultations/session-timing';
import { isKnownUserId } from '@/lib/consultations/identity-utils';
import {
  buildWaitingRoomHistorySnapshot,
  type WaitingRoomHistorySnapshot,
} from '@/lib/consultations/waiting-room-history';
import { serviceOk, type ServiceResult } from '@/lib/services/shared/service-result';
import { CallSummaryRepository } from '@/lib/repositories/call-summary-repository';
import { ConsultationRepository } from '@/lib/repositories/consultation-repository';
import { ConsultationSessionRepository } from '@/lib/repositories/consultation-session-repository';
import { RoomDoctorPresenceRepository } from '@/lib/repositories/room-doctor-presence-repository';
import { generateAndStoreConsultationSummary } from './summary-generator';
import type {
  ConsultationFinalizationService,
  FinalizationReason,
  FinalizationResult,
  FinalizeConsultationInput,
} from './contracts';

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

function normalizeKnownPatientUserId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return isKnownUserId(normalized) ? normalized : null;
}

function resolveWaitingHistoryPatientEmail(waitingRoomHistory: WaitingRoomHistorySnapshot): string | null {
  const admittedRegisteredParticipant = waitingRoomHistory.participants.find((participant) =>
    participant.status === 'admitted'
    && !participant.isAnonymous
    && typeof participant.patientEmail === 'string'
    && participant.patientEmail.trim().length > 0
  );
  if (admittedRegisteredParticipant?.patientEmail) {
    return admittedRegisteredParticipant.patientEmail;
  }

  return waitingRoomHistory.participantEmails[0] || null;
}

function resolveConsultationSessionIdFromDoc(consultationData: Record<string, unknown>): string | null {
  const consultationSessionId = consultationData.consultationSessionId;
  if (typeof consultationSessionId !== 'string' || !consultationSessionId.trim()) {
    return null;
  }

  return consultationSessionId.trim();
}

function pickSessionDocument(
  docs: Array<{ id: string; data: Record<string, unknown> }>,
  input: { requireActiveSession: boolean }
) {
  const sortedByStart = [...docs].sort((left, right) => {
    const leftStartedAt = toDate(left.data.sessionStartedAt || left.data.createdAt)?.getTime() || 0;
    const rightStartedAt = toDate(right.data.sessionStartedAt || right.data.createdAt)?.getTime() || 0;
    return rightStartedAt - leftStartedAt;
  });

  const activeSession = sortedByStart.find((candidate) => candidate.data.status === 'active') || null;
  if (input.requireActiveSession) {
    return activeSession;
  }

  return activeSession || sortedByStart[0] || null;
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
  if (
    input.reason === 'doctor_left'
    || input.reason === 'patient_left'
    || input.reason === 'patient_left_webhook'
    || input.reason === 'room_finished_webhook'
  ) {
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
    const presenceDoc = await new RoomDoctorPresenceRepository(db).getByRoom(input.roomName);
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
  const summaryRepo = new CallSummaryRepository(db);
  const summaryDoc = await summaryRepo.getById(input.consultationSessionId);
  if (!summaryDoc.exists) {
    return;
  }

  const summaryData = summaryDoc.data() as Record<string, unknown>;
  const summaryMetadata = (summaryData.metadata as Record<string, unknown> | undefined) || {};
  await summaryRepo.mergeFields(input.consultationSessionId, {
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
  });
}

// Event-level idempotency guard. When a backstop (webhook) fires after the
// reliable client-leave path has already finalized and produced a real summary,
// re-running the full finalization is wasted work. If the session is completed
// and its summary is already finalized (real AI generation or a doctor edit),
// short-circuit and return the existing result.
async function findAlreadyFinalizedResult(
  db: Firestore,
  consultationSessionId: string,
  sessionStatus: unknown
): Promise<FinalizationResult | null> {
  if (sessionStatus !== 'completed') {
    return null;
  }

  try {
    const summaryDoc = await new CallSummaryRepository(db).getById(consultationSessionId);
    if (!summaryDoc.exists) {
      return null;
    }

    const summaryData = (summaryDoc.data() as Record<string, unknown>) || {};
    const metadata = (summaryData.metadata as Record<string, unknown> | undefined) || {};
    const isFinalized = metadata.isEdited === true || metadata.aiSummaryGenerated === true;
    if (!isFinalized) {
      return null;
    }

    return {
      consultationSessionId,
      finalDurationMinutes: parseDuration(summaryData.duration),
    };
  } catch (error) {
    console.warn('Failed idempotency lookup during finalization:', error);
    return null;
  }
}

async function runFinalization(
  db: Firestore,
  {
    roomName,
    finalizedAt,
    reason,
    requireActiveSession = false,
    regenerateSummary = true,
  }: FinalizeConsultationInput
): Promise<FinalizationResult | null> {
  const sessionRepo = new ConsultationSessionRepository(db);
  const consultationRepo = new ConsultationRepository(db);

  const sessionDocs = await sessionRepo.findByRoom(roomName, 50);
  if (sessionDocs.length === 0) {
    return null;
  }

  const sessionCandidates = sessionDocs.map((doc) => ({
    id: doc.id,
    data: doc.data() as Record<string, unknown>,
  }));
  const selectedSession = pickSessionDocument(sessionCandidates, {
    requireActiveSession,
  });
  if (!selectedSession) {
    return null;
  }

  const consultationSessionId =
    typeof selectedSession.data.consultationSessionId === 'string' &&
    selectedSession.data.consultationSessionId.trim()
      ? selectedSession.data.consultationSessionId.trim()
      : selectedSession.id;

  // Skip duplicate finalization triggered by a backstop after the primary path
  // already produced a finalized summary for this session.
  const alreadyFinalized = await findAlreadyFinalizedResult(
    db,
    consultationSessionId,
    selectedSession.data.status
  );
  if (alreadyFinalized) {
    console.log(
      'Skipping duplicate finalization; session already finalized:',
      consultationSessionId,
      'reason:',
      reason
    );
    return alreadyFinalized;
  }

  const sessionDoc = await sessionRepo.getById(consultationSessionId);
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
    consultationSessionId,
    sessionStartedAt,
    sessionEndedAt: effectiveSessionEndedAt,
  });
  const sessionPatientUserId =
    normalizeKnownPatientUserId(sessionData.patientUserId)
    || normalizeKnownPatientUserId(sessionMetadata.patientUserId);
  const waitingHistoryPatientEmail = resolveWaitingHistoryPatientEmail(waitingRoomHistory);
  const sessionPatientEmail =
    (sessionData.patientEmail as string | undefined)
    || (typeof sessionMetadata.patientEmail === 'string' ? sessionMetadata.patientEmail : null)
    || waitingHistoryPatientEmail;

  await sessionRepo.mergeFields(consultationSessionId, {
    consultationSessionId,
    roomName,
    ...(doctorUserId ? { doctorUserId } : {}),
    status: 'completed',
    sessionStartedAt,
    sessionEndedAt: effectiveSessionEndedAt,
    duration: finalDurationMinutes,
    patientUserId: sessionPatientUserId,
    ...(sessionPatientEmail ? { patientEmail: sessionPatientEmail } : {}),
    metadata: {
      ...sessionMetadata,
      durationMinutes: finalDurationMinutes,
      finalDurationMinutes: finalDurationMinutes,
      sessionEndedAt: effectiveSessionEndedAt.toISOString(),
      finalizedAt: finalizedAt.toISOString(),
      finalizationReason: reason,
      waitingRoomHistory,
      patientUserId: sessionPatientUserId,
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date(),
  });

  const consultationDoc = await consultationRepo.getByRoom(roomName);
  const consultationData = (consultationDoc.exists ? consultationDoc.data() : {}) as Record<string, unknown>;
  const consultationMetadata = (consultationData.metadata as Record<string, unknown> | undefined) || {};
  const consultationDocSessionId = resolveConsultationSessionIdFromDoc(consultationData);
  const consultationDocMatchesCurrentSession =
    consultationDocSessionId === consultationSessionId;
  const consultationPatientEmail =
    sessionPatientEmail
    || (consultationDocMatchesCurrentSession
      ? (consultationData.patientEmail as string | undefined)
        || (typeof consultationMetadata.patientEmail === 'string' ? consultationMetadata.patientEmail : null)
      : null);
  await consultationRepo.mergeFields(roomName, {
    roomName,
    consultationSessionId,
    sessionStartedAt,
    leftAt: effectiveSessionEndedAt,
    duration: finalDurationMinutes,
    status: 'completed',
    awaitingPatient: false,
    patientUserId: sessionPatientUserId,
    ...(consultationPatientEmail ? { patientEmail: consultationPatientEmail } : {}),
    metadata: {
      ...consultationMetadata,
      durationMinutes: finalDurationMinutes,
      finalDurationMinutes: finalDurationMinutes,
      sessionEndedAt: effectiveSessionEndedAt.toISOString(),
      finalizedAt: finalizedAt.toISOString(),
      finalizationReason: reason,
      waitingRoomHistory,
      patientUserId: sessionPatientUserId,
    },
  });

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
        sessionPatientUserId
        || (consultationDocMatchesCurrentSession
          ? normalizeKnownPatientUserId(consultationData.patientUserId)
            || normalizeKnownPatientUserId(consultationMetadata.patientUserId)
          : null);

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

/**
 * Deep service that owns consultation finalization end-to-end: it selects the
 * session for a room, records final duration/timestamps, snapshots waiting-room
 * history, and (re)generates the stored AI summary. Idempotent across the
 * multiple lifecycle triggers (client leave, webhook backstop, invitation
 * endings, history rebuild).
 */
export class ConsultationFinalizationCore implements ConsultationFinalizationService {
  constructor(private readonly db: Firestore) {}

  async finalizeConsultation(
    input: FinalizeConsultationInput
  ): Promise<ServiceResult<FinalizationResult | null>> {
    const result = await runFinalization(this.db, input);
    return serviceOk(result);
  }
}

/**
 * Backward-compatible free-function entry point. Prefer ConsultationFinalizationCore
 * for new call sites; this exists so existing lifecycle callers keep working
 * while the service idiom is rolled out.
 */
export async function finalizeConsultationForRoom(
  db: Firestore,
  input: FinalizeConsultationInput
): Promise<FinalizationResult | null> {
  return runFinalization(db, input);
}

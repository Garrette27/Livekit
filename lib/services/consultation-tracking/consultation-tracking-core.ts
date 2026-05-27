import type { Firestore } from 'firebase-admin/firestore';
import { buildVisibleUserIds, isKnownUserId } from '@/lib/consultations/identity-utils';
import { calculateDurationMinutes } from '@/lib/consultations/session-timing';
import { resolveLeaveSessionId } from '@/lib/consultations/consultation-session-store';
import { FirestoreConsultationSessionCore } from '@/lib/services/video-chat';
import { finalizeConsultationForRoom } from '@/lib/services/consultation-finalization';
import { RoomRepository } from '@/lib/repositories/room-repository';
import { ConsultationRepository } from '@/lib/repositories/consultation-repository';
import { ConsultationSessionRepository } from '@/lib/repositories/consultation-session-repository';
import { serviceOk, type ServiceResult } from '@/lib/services/shared/service-result';
import type {
  ConsultationTrackingService,
  TrackConsultationInput,
  TrackConsultationResult,
} from './contracts';

interface ResolvedPatientIdentity {
  patientUserId: string;
  patientEmail: string | null;
}

function toDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  const maybeDateLike = value as { toDate?: () => Date; toMillis?: () => number };
  if (typeof maybeDateLike.toDate === 'function') {
    return maybeDateLike.toDate();
  }
  if (typeof maybeDateLike.toMillis === 'function') {
    return new Date(maybeDateLike.toMillis());
  }
  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolvePatientIdentity(params: {
  userId?: string;
  patientEmail?: string;
  doctorUserId: string;
  existingPatientUserId?: string | null;
  existingPatientEmail?: string | null;
  preferExistingKnownPatient?: boolean;
}): ResolvedPatientIdentity {
  const {
    userId,
    patientEmail,
    doctorUserId,
    existingPatientUserId,
    existingPatientEmail,
    preferExistingKnownPatient = false,
  } = params;

  let resolvedPatientUserId = isKnownUserId(userId) ? userId : 'anonymous';
  let resolvedPatientEmail: string | null = patientEmail?.trim().toLowerCase() || null;

  if (resolvedPatientUserId === doctorUserId) {
    resolvedPatientUserId = 'anonymous';
  }

  const shouldCarryExistingKnownIdentity =
    preferExistingKnownPatient &&
    isKnownUserId(resolvedPatientUserId) &&
    isKnownUserId(existingPatientUserId) &&
    resolvedPatientUserId === existingPatientUserId;

  if (shouldCarryExistingKnownIdentity && !resolvedPatientEmail) {
    resolvedPatientEmail = existingPatientEmail || null;
  }

  return {
    patientUserId: shouldCarryExistingKnownIdentity
      ? (existingPatientUserId as string)
      : resolvedPatientUserId || 'anonymous',
    patientEmail: resolvedPatientEmail || null,
  };
}

export class FirestoreConsultationTrackingCore implements ConsultationTrackingService {
  private readonly db: Firestore;
  private readonly sessionCore: FirestoreConsultationSessionCore;
  private readonly roomRepo: RoomRepository;
  private readonly consultationRepo: ConsultationRepository;
  private readonly sessionRepo: ConsultationSessionRepository;

  constructor(db: Firestore) {
    this.db = db;
    this.sessionCore = new FirestoreConsultationSessionCore(db);
    this.roomRepo = new RoomRepository(db);
    this.consultationRepo = new ConsultationRepository(db);
    this.sessionRepo = new ConsultationSessionRepository(db);
  }

  private async lookupDoctorUserId(roomName: string): Promise<string> {
    try {
      const roomDoc = await this.roomRepo.getByRoom(roomName);
      if (!roomDoc.exists) {
        return 'unknown';
      }
      const roomData = roomDoc.data();
      return roomData?.createdBy || roomData?.metadata?.createdBy || 'unknown';
    } catch (error) {
      console.error('Error looking up room creator:', error);
      return 'unknown';
    }
  }

  async trackConsultation(input: TrackConsultationInput): Promise<ServiceResult<TrackConsultationResult>> {
    const { roomName, action } = input;
    const doctorUserId = await this.lookupDoctorUserId(roomName);

    // Doctor lifecycle events are tracked separately and must not overwrite patient state.
    const isDoctorLifecycleEvent =
      Boolean(input.userId) && doctorUserId !== 'unknown' && input.userId === doctorUserId;
    if (isDoctorLifecycleEvent) {
      return serviceOk({ message: 'Doctor lifecycle event ignored', roomName, action });
    }

    const consultationDoc = await this.consultationRepo.getByRoom(roomName);
    const existingData = consultationDoc.exists ? (consultationDoc.data() as Record<string, any>) : null;

    const resolvedPatient = resolvePatientIdentity({
      userId: input.userId,
      patientEmail: input.patientEmail,
      doctorUserId,
      existingPatientUserId: existingData?.patientUserId || existingData?.metadata?.patientUserId || null,
      existingPatientEmail: existingData?.patientEmail || existingData?.metadata?.patientEmail || null,
      preferExistingKnownPatient: action === 'leave',
    });

    if (action === 'join') {
      const consultationSessionId = await this.handleJoin({
        roomName,
        patientName: input.patientName,
        patientUserId: resolvedPatient.patientUserId,
        patientEmail: resolvedPatient.patientEmail,
        doctorUserId,
        existingData,
      });
      return serviceOk({ message: 'Consultation join tracked successfully', roomName, action, consultationSessionId });
    }

    const leaveResult = await this.handleLeave({
      roomName,
      patientName: input.patientName,
      patientUserId: resolvedPatient.patientUserId,
      patientEmail: resolvedPatient.patientEmail,
      doctorUserId,
      existingData,
      preferredConsultationSessionId: input.consultationSessionId,
    });
    return serviceOk({
      message: 'Consultation leave tracked successfully',
      roomName,
      action,
      consultationSessionId: leaveResult.consultationSessionId,
      durationMinutes: leaveResult.durationMinutes,
    });
  }

  private async handleJoin(params: {
    roomName: string;
    patientName: string;
    patientUserId: string;
    patientEmail: string | null;
    doctorUserId: string;
    existingData: Record<string, any> | null;
  }): Promise<string> {
    const { roomName, patientName, patientUserId, patientEmail, doctorUserId, existingData } = params;
    const now = new Date();
    const existingVisibleToUsers = existingData?.metadata?.visibleToUsers || [];

    const session = await this.sessionCore.startSession({
      roomName,
      doctorUserId,
      patientUserId,
      patientEmail,
      patientName,
      existingData,
      now,
      // Treat each completed encounter as immutable history. Rejoins create a new session id.
      allowCompletedReuse: false,
    });

    await this.consultationRepo.mergeFields(roomName, {
      roomName,
      patientName: patientName || existingData?.patientName || 'Unknown Patient',
      patientUserId,
      patientEmail,
      joinedAt: now,
      sessionStartedAt: session.sessionStartedAt,
      consultationSessionId: session.sessionId,
      status: 'active',
      isRealConsultation: true,
      createdBy: doctorUserId,
      metadata: {
        ...(existingData?.metadata || {}),
        source: 'patient_join',
        trackedAt: now,
        createdBy: doctorUserId,
        patientUserId,
        patientEmail,
        doctorUserId,
        consultationSessionId: session.sessionId,
        visibleToUsers: buildVisibleUserIds(doctorUserId, patientUserId, existingVisibleToUsers),
      },
    });

    return session.sessionId;
  }

  private async handleLeave(params: {
    roomName: string;
    patientName: string;
    patientUserId: string;
    patientEmail: string | null;
    doctorUserId: string;
    existingData: Record<string, any> | null;
    preferredConsultationSessionId?: string;
  }): Promise<{ consultationSessionId: string | null; durationMinutes: number }> {
    const { roomName, patientName, patientUserId, patientEmail, doctorUserId, existingData, preferredConsultationSessionId } = params;
    if (!existingData) {
      return { consultationSessionId: null, durationMinutes: 0 };
    }

    const now = new Date();
    const consultationSessionId =
      preferredConsultationSessionId?.trim() || resolveLeaveSessionId({ roomName, existingData, now });
    let sessionStartedAt = toDate(existingData.sessionStartedAt || existingData.joinedAt) || now;
    let doctorDurationFromSessionMinutes = 0;

    try {
      const sessionDoc = await this.sessionRepo.getById(consultationSessionId);
      if (sessionDoc.exists) {
        const sessionData = sessionDoc.data() as Record<string, unknown>;
        const sessionSnapshotStartedAt = toDate(sessionData?.sessionStartedAt);
        if (sessionSnapshotStartedAt) {
          sessionStartedAt = sessionSnapshotStartedAt;
        }
        const doctorDurationCandidate = Number(
          (sessionData?.metadata as Record<string, unknown> | undefined)?.doctorDurationMinutes || 0
        );
        if (Number.isFinite(doctorDurationCandidate) && doctorDurationCandidate > 0) {
          doctorDurationFromSessionMinutes = Math.round(doctorDurationCandidate);
        }
      }
    } catch (sessionLookupError) {
      console.error('Error resolving sessionStartedAt from session snapshot:', sessionLookupError);
    }

    const durationMinutes = calculateDurationMinutes({ startedAt: sessionStartedAt, endedAt: now });
    const finalDurationMinutes = Math.max(durationMinutes, doctorDurationFromSessionMinutes);
    const existingVisibleToUsers = existingData.metadata?.visibleToUsers || [];

    await this.consultationRepo.mergeFields(roomName, {
      roomName,
      patientName: patientName || existingData.patientName || 'Unknown Patient',
      patientUserId,
      patientEmail,
      consultationSessionId,
      sessionStartedAt,
      leftAt: now,
      duration: finalDurationMinutes,
      status: 'completed',
      isRealConsultation: true,
      createdBy: doctorUserId,
      metadata: {
        ...(existingData.metadata || {}),
        source: 'patient_leave',
        trackedAt: now,
        durationMinutes: finalDurationMinutes,
        createdBy: doctorUserId,
        patientUserId,
        patientEmail,
        doctorUserId,
        consultationSessionId,
        visibleToUsers: buildVisibleUserIds(doctorUserId, patientUserId, existingVisibleToUsers),
      },
    });

    await this.sessionCore.closeSession({
      sessionId: consultationSessionId,
      roomName,
      doctorUserId,
      patientUserId,
      sessionStartedAt,
      sessionEndedAt: now,
      eventType: 'left',
      actorType: 'patient',
      actorId: patientUserId,
      metadata: { source: 'track-consultation-leave', patientName, patientEmail, durationMinutes: finalDurationMinutes },
    });

    // Generate the AI summary on this reliable, client-driven leave path. The
    // LiveKit room_finished/participant_left webhook remains an idempotent
    // backstop, but summary generation must not depend on it firing.
    try {
      await finalizeConsultationForRoom(this.db, {
        roomName,
        finalizedAt: now,
        reason: 'patient_left',
        requireActiveSession: false,
        regenerateSummary: true,
      });
    } catch (finalizationError) {
      console.error('Failed to finalize consultation on patient leave:', finalizationError);
    }

    return { consultationSessionId, durationMinutes: finalDurationMinutes };
  }
}

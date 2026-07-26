import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { appendPresenceEvent } from '@/lib/consultations/consultation-session-store';
import { ConsultationRepository } from '@/lib/repositories/consultation-repository';
import { ConsultationSessionRepository } from '@/lib/repositories/consultation-session-repository';
import { RoomDoctorPresenceRepository } from '@/lib/repositories/room-doctor-presence-repository';
import { serviceOk, type ServiceResult } from '@/lib/services/shared/service-result';
import type {
  DoctorPresenceService,
  TrackDoctorPresenceInput,
  TrackDoctorPresenceResult,
} from './contracts';
import { finalizeConsultationForRoom } from '@/lib/services/consultation-finalization';

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

export class FirestoreDoctorPresenceCore implements DoctorPresenceService {
  private readonly db: Firestore;
  private readonly presenceRepo: RoomDoctorPresenceRepository;
  private readonly consultationRepo: ConsultationRepository;
  private readonly sessionRepo: ConsultationSessionRepository;

  constructor(db: Firestore) {
    this.db = db;
    this.presenceRepo = new RoomDoctorPresenceRepository(db);
    this.consultationRepo = new ConsultationRepository(db);
    this.sessionRepo = new ConsultationSessionRepository(db);
  }

  private async resolveConsultationSessionId(
    roomName: string,
    preferredSessionId?: string | null
  ): Promise<string | null> {
    if (preferredSessionId && preferredSessionId.trim()) {
      return preferredSessionId.trim();
    }

    const consultationDoc = await this.consultationRepo.getByRoom(roomName);
    if (!consultationDoc.exists) {
      return null;
    }

    const sessionId = (consultationDoc.data() as Record<string, unknown>)?.consultationSessionId;
    return typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : null;
  }

  private async applyDoctorDurationToSession(input: {
    consultationSessionId: string;
    roomName: string;
    doctorUserId: string;
    segmentDurationMs: number;
    doctorName?: string | null;
    doctorEmail?: string | null;
  }): Promise<number> {
    const sessionDoc = await this.sessionRepo.getById(input.consultationSessionId);
    const sessionData = sessionDoc.exists ? (sessionDoc.data() as Record<string, unknown>) : {};
    const sessionMetadata = (sessionData.metadata as Record<string, unknown> | undefined) || {};
    const currentDurationMsRaw = Number(sessionMetadata.doctorDurationMs || 0);
    const currentDurationMs =
      Number.isFinite(currentDurationMsRaw) && currentDurationMsRaw > 0 ? currentDurationMsRaw : 0;
    const nextDurationMs = currentDurationMs + Math.max(0, input.segmentDurationMs);
    const nextDurationMinutes = Math.max(0, Math.round(nextDurationMs / 60000));

    await this.sessionRepo.mergeFields(input.consultationSessionId, {
      roomName: input.roomName,
      doctorUserId: input.doctorUserId,
      metadata: {
        ...sessionMetadata,
        doctorDurationMs: nextDurationMs,
        doctorDurationMinutes: nextDurationMinutes,
        doctorName: input.doctorName || null,
        doctorEmail: input.doctorEmail || null,
        lastDoctorLeftAt: new Date().toISOString(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    return nextDurationMinutes;
  }

  async trackPresence({
    roomName,
    action,
    doctorUserId,
    doctorName = null,
    doctorEmail = null,
    consultationSessionId: preferredSessionId = null,
  }: TrackDoctorPresenceInput): Promise<ServiceResult<TrackDoctorPresenceResult>> {
    const now = new Date();
    const roomPresenceDoc = await this.presenceRepo.getByRoom(roomName);
    const roomPresenceData = roomPresenceDoc.exists
      ? (roomPresenceDoc.data() as Record<string, unknown>)
      : {};
    const activeDoctors = {
      ...((roomPresenceData.activeDoctors as Record<string, Record<string, unknown> | undefined>) || {}),
    };
    const activeDoctor = activeDoctors[doctorUserId] || null;

    if (action === 'join') {
      const alreadyActiveJoinedAt = toDate(activeDoctor?.joinedAt);
      if (alreadyActiveJoinedAt) {
        return serviceOk({
          message: 'Doctor already active in room',
          consultationSessionId: (activeDoctor?.consultationSessionId as string | undefined) || null,
        });
      }

      const consultationSessionId = await this.resolveConsultationSessionId(roomName, preferredSessionId);
      activeDoctors[doctorUserId] = { joinedAt: now, doctorName, doctorEmail, consultationSessionId };

      await this.presenceRepo.mergeFields(roomName, { roomName, activeDoctors, updatedAt: now });

      if (consultationSessionId) {
        await appendPresenceEvent(this.db, {
          consultationSessionId,
          roomName,
          doctorUserId,
          actorType: 'doctor',
          eventType: 'joined',
          eventAt: now,
          metadata: { doctorName, doctorEmail, source: 'doctor-presence-tracker' },
        });
      }

      return serviceOk({ message: 'Doctor join tracked', consultationSessionId });
    }

    const joinedAt = toDate(activeDoctor?.joinedAt);
    if (!joinedAt) {
      return serviceOk({ message: 'Doctor was not marked active in this room' });
    }

    const segmentDurationMs = Math.max(0, now.getTime() - joinedAt.getTime());
    delete activeDoctors[doctorUserId];
    const lastLeftAtByDoctor = {
      ...((roomPresenceData.lastLeftAtByDoctor as Record<string, unknown> | undefined) || {}),
      [doctorUserId]: now,
    };
    await this.presenceRepo.mergeFields(roomName, {
      roomName,
      activeDoctors,
      updatedAt: now,
      lastLeftAtByDoctor,
    });

    const consultationSessionId = await this.resolveConsultationSessionId(
      roomName,
      preferredSessionId ||
        (typeof activeDoctor?.consultationSessionId === 'string' ? activeDoctor.consultationSessionId : null)
    );

    if (!consultationSessionId) {
      return serviceOk({ message: 'Doctor leave tracked (no active consultation session to update)' });
    }

    const doctorDurationMinutes = await this.applyDoctorDurationToSession({
      consultationSessionId,
      roomName,
      doctorUserId,
      segmentDurationMs,
      doctorName,
      doctorEmail,
    });

    await appendPresenceEvent(this.db, {
      consultationSessionId,
      roomName,
      doctorUserId,
      actorType: 'doctor',
      eventType: 'left',
      eventAt: now,
      metadata: { doctorName, doctorEmail, segmentDurationMs, doctorDurationMinutes, source: 'doctor-presence-tracker' },
    });

    // Last-doctor leave is the canonical consultation-ending command. Summary
    // finalization is idempotent, while webhook/revoke paths remain backstops.
    if (Object.keys(activeDoctors).length === 0) {
      try {
        await finalizeConsultationForRoom(this.db, {
          roomName,
          finalizedAt: now,
          reason: 'doctor_left',
          requireActiveSession: false,
          regenerateSummary: true,
        });
      } catch (error) {
        // Presence is already committed; keep the leave response successful so
        // webhook/revoke can retry the same idempotent finalization later.
        console.error('Failed to finalize consultation on last doctor leave:', error);
      }
    }

    return serviceOk({
      message: 'Doctor leave tracked',
      consultationSessionId,
      doctorDurationMinutes,
      finalDurationMinutes: doctorDurationMinutes,
    });
  }
}

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  appendPresenceEvent,
  createConsultationSessionId,
  upsertSessionSnapshot,
} from '@/lib/consultations/consultation-session-store';
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

  /**
   * The session id for a still-running encounter in this room, or null when the
   * most recent one has already been completed. Completed encounters are
   * immutable history, so re-entering a room must never reopen them.
   */
  private async findActiveConsultationSessionId(
    roomName: string,
    preferredSessionId?: string | null
  ): Promise<string | null> {
    const candidateSessionId = await this.resolveConsultationSessionId(roomName, preferredSessionId);
    if (!candidateSessionId) {
      return null;
    }

    const sessionDoc = await this.sessionRepo.getById(candidateSessionId);
    if (!sessionDoc.exists) {
      return null;
    }

    const sessionData = sessionDoc.data() as Record<string, unknown>;
    const belongsToRoom = sessionData.roomName === roomName;
    return belongsToRoom && sessionData.status === 'active' ? candidateSessionId : null;
  }

  /**
   * The consultation session the doctor is entering, opening a new one when no
   * encounter is running. Treating the doctor's arrival as the start of the
   * encounter is what lets a consultation be recorded at all when no patient
   * ever joins — previously nothing existed until a patient arrived, so those
   * consultations left no trace in history.
   */
  private async openConsultationSession(input: {
    roomName: string;
    doctorUserId: string;
    doctorName: string | null;
    doctorEmail: string | null;
    preferredSessionId: string | null;
    now: Date;
  }): Promise<string> {
    const activeSessionId = await this.findActiveConsultationSessionId(
      input.roomName,
      input.preferredSessionId
    );
    if (activeSessionId) {
      return activeSessionId;
    }

    const consultationSessionId = createConsultationSessionId(input.roomName, input.now);
    await upsertSessionSnapshot(this.db, {
      consultationSessionId,
      roomName: input.roomName,
      doctorUserId: input.doctorUserId,
      patientUserId: null,
      status: 'active',
      sessionStartedAt: input.now,
      metadata: {
        source: 'doctor-presence-core.openConsultationSession',
        doctorName: input.doctorName,
        doctorEmail: input.doctorEmail,
        openedByDoctorAt: input.now.toISOString(),
      },
    });

    // Patient fields are cleared explicitly: this room document is shared across
    // encounters, and leftover identity from the previous one would otherwise be
    // attributed to this new consultation.
    await this.consultationRepo.mergeFields(input.roomName, {
      roomName: input.roomName,
      consultationSessionId,
      sessionStartedAt: input.now,
      leftAt: null,
      duration: 0,
      status: 'active',
      awaitingPatient: true,
      isRealConsultation: true,
      createdBy: input.doctorUserId,
      patientName: null,
      patientUserId: null,
      patientEmail: null,
      metadata: {
        source: 'doctor_open',
        trackedAt: input.now,
        createdBy: input.doctorUserId,
        doctorUserId: input.doctorUserId,
        consultationSessionId,
        patientUserId: null,
        patientEmail: null,
      },
    });

    return consultationSessionId;
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

      const consultationSessionId = await this.openConsultationSession({
        roomName,
        doctorUserId,
        doctorName,
        doctorEmail,
        preferredSessionId,
        now,
      });
      activeDoctors[doctorUserId] = { joinedAt: now, doctorName, doctorEmail, consultationSessionId };

      await this.presenceRepo.mergeFields(roomName, { roomName, activeDoctors, updatedAt: now });

      await appendPresenceEvent(this.db, {
        consultationSessionId,
        roomName,
        doctorUserId,
        actorType: 'doctor',
        eventType: 'joined',
        eventAt: now,
        metadata: { doctorName, doctorEmail, source: 'doctor-presence-tracker' },
      });

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

    // The session recorded when this doctor joined is authoritative; a client
    // may report a stale id that belongs to a different encounter.
    const consultationSessionId = await this.resolveConsultationSessionId(
      roomName,
      (typeof activeDoctor?.consultationSessionId === 'string' ? activeDoctor.consultationSessionId : null)
        || preferredSessionId
    );

    let doctorDurationMinutes = 0;
    if (consultationSessionId) {
      doctorDurationMinutes = await this.applyDoctorDurationToSession({
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
    }

    // Last-doctor leave is the canonical consultation-ending command. Summary
    // finalization is idempotent, while webhook/revoke paths remain backstops.
    // It runs even when no session id resolved here, because finalization can
    // still find the room's session and would otherwise leave it open forever.
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
      consultationSessionId: consultationSessionId || undefined,
      doctorDurationMinutes,
      finalDurationMinutes: doctorDurationMinutes,
    });
  }
}

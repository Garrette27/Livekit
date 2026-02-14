import type { Firestore } from 'firebase-admin/firestore';
import {
  appendPresenceEvent,
  resolveJoinSession,
  upsertSessionSnapshot,
  type ConsultationPresenceEventType,
} from '@/lib/consultations/consultation-session-store';
import type {
  AppendSessionEventInput,
  CloseSessionInput,
  ConsultationSessionStore,
  StartSessionInput,
  StartSessionResult,
} from './contracts';

function ensureKnownPatientUserId(candidate?: string | null): string | null {
  if (!candidate) {
    return null;
  }

  const normalized = candidate.trim();
  if (!normalized || normalized === 'anonymous') {
    return null;
  }

  return normalized;
}

function resolveActorId(input: AppendSessionEventInput): string | null {
  if (input.actorId && input.actorId.trim()) {
    return input.actorId.trim();
  }

  if (input.actorType === 'doctor' && input.doctorUserId) {
    return input.doctorUserId;
  }

  if (input.actorType === 'patient' && input.patientUserId) {
    return input.patientUserId;
  }

  return null;
}

/**
 * Backend-only consultation lifecycle module.
 * This keeps session state transitions and timeline writes in one place.
 */
export class FirestoreConsultationSessionCore implements ConsultationSessionStore {
  constructor(private readonly db: Firestore) {}

  async startSession(input: StartSessionInput): Promise<StartSessionResult> {
    const now = input.now || new Date();
    const nextPatientUserId = ensureKnownPatientUserId(input.patientUserId);
    const existingPatientUserId = ensureKnownPatientUserId(
      (input.existingData?.patientUserId as string | undefined)
      || (input.existingData?.metadata as { patientUserId?: string } | undefined)?.patientUserId
      || null
    );

    const resolved = resolveJoinSession({
      roomName: input.roomName,
      existingData: (input.existingData as Record<string, unknown>) || null,
      existingPatientUserId,
      nextPatientUserId,
      allowCompletedReuse: input.allowCompletedReuse || false,
      now,
    });

    await upsertSessionSnapshot(this.db, {
      consultationSessionId: resolved.consultationSessionId,
      roomName: input.roomName,
      doctorUserId: input.doctorUserId,
      patientUserId: nextPatientUserId,
      status: 'active',
      sessionStartedAt: resolved.sessionStartedAt,
      metadata: {
        source: 'consultation-session-core.startSession',
        patientName: input.patientName || null,
        patientEmail: input.patientEmail || null,
      },
    });

    await appendPresenceEvent(this.db, {
      consultationSessionId: resolved.consultationSessionId,
      roomName: input.roomName,
      doctorUserId: input.doctorUserId,
      patientUserId: nextPatientUserId,
      actorType: 'patient',
      actorId: nextPatientUserId,
      eventType: resolved.eventType,
      eventAt: now,
      metadata: {
        patientName: input.patientName || null,
        patientEmail: input.patientEmail || null,
        source: 'consultation-session-core.startSession',
      },
    });

    return {
      sessionId: resolved.consultationSessionId,
      sessionStartedAt: resolved.sessionStartedAt,
      eventType: resolved.eventType,
      reusedExistingSession: resolved.reusedExistingSession,
    };
  }

  async appendEvent(input: AppendSessionEventInput): Promise<void> {
    await appendPresenceEvent(this.db, {
      consultationSessionId: input.sessionId,
      roomName: input.roomName,
      doctorUserId: input.doctorUserId || null,
      patientUserId: input.patientUserId || null,
      actorType: input.actorType,
      actorId: resolveActorId(input),
      eventType: input.eventType as ConsultationPresenceEventType,
      eventAt: input.eventAt || new Date(),
      metadata: {
        ...(input.metadata || {}),
        source: 'consultation-session-core.appendEvent',
      },
    });
  }

  async closeSession(input: CloseSessionInput): Promise<void> {
    await upsertSessionSnapshot(this.db, {
      consultationSessionId: input.sessionId,
      roomName: input.roomName,
      doctorUserId: input.doctorUserId || null,
      patientUserId: input.patientUserId || null,
      status: 'completed',
      sessionStartedAt: input.sessionStartedAt,
      sessionEndedAt: input.sessionEndedAt,
      metadata: {
        ...(input.metadata || {}),
        source: 'consultation-session-core.closeSession',
      },
    });

    if (input.eventType) {
      await appendPresenceEvent(this.db, {
        consultationSessionId: input.sessionId,
        roomName: input.roomName,
        doctorUserId: input.doctorUserId || null,
        patientUserId: input.patientUserId || null,
        actorType: input.actorType || 'system',
        actorId: input.actorId || null,
        eventType: input.eventType,
        eventAt: input.sessionEndedAt,
        metadata: {
          ...(input.metadata || {}),
          source: 'consultation-session-core.closeSession',
        },
      });
    }
  }
}

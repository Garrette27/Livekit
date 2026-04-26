import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { appendPresenceEvent } from '@/lib/consultations/consultation-session-store';
import { finalizeConsultationForRoom } from '@/lib/consultations/session-finalization';

type DoctorPresenceAction = 'join' | 'leave';

interface TrackDoctorPresenceRequest {
  roomName?: string;
  action?: DoctorPresenceAction;
  doctorUserId?: string;
  doctorName?: string | null;
  doctorEmail?: string | null;
  consultationSessionId?: string | null;
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

async function resolveConsultationSessionId(
  db: any,
  roomName: string,
  preferredSessionId?: string | null
): Promise<string | null> {
  if (preferredSessionId && preferredSessionId.trim()) {
    return preferredSessionId.trim();
  }

  const consultationDoc = await db.collection('consultations').doc(roomName).get();
  if (!consultationDoc.exists) {
    return null;
  }

  const consultationData = consultationDoc.data() as Record<string, unknown>;
  const sessionId = consultationData?.consultationSessionId;
  if (typeof sessionId === 'string' && sessionId.trim()) {
    return sessionId.trim();
  }

  return null;
}

async function applyDoctorDurationToSession(
  db: any,
  input: {
    consultationSessionId: string;
    roomName: string;
    doctorUserId: string;
    segmentDurationMs: number;
    doctorName?: string | null;
    doctorEmail?: string | null;
  }
): Promise<number> {
  const sessionRef = db.collection('consultationSessions').doc(input.consultationSessionId);
  const sessionDoc = await sessionRef.get();
  const sessionData = sessionDoc.exists ? (sessionDoc.data() as Record<string, unknown>) : {};
  const sessionMetadata = (sessionData.metadata as Record<string, unknown> | undefined) || {};
  const currentDurationMsRaw = Number(sessionMetadata.doctorDurationMs || 0);
  const currentDurationMs = Number.isFinite(currentDurationMsRaw) && currentDurationMsRaw > 0
    ? currentDurationMsRaw
    : 0;
  const nextDurationMs = currentDurationMs + Math.max(0, input.segmentDurationMs);
  const nextDurationMinutes = Math.max(0, Math.round(nextDurationMs / 60000));

  await sessionRef.set(
    {
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
    },
    { merge: true }
  );

  return nextDurationMinutes;
}

async function finalizeOnLastDoctorLeave(
  db: Firestore,
  input: { roomName: string; finalizedAt: Date }
): Promise<void> {
  try {
    await finalizeConsultationForRoom(db, {
      roomName: input.roomName,
      finalizedAt: input.finalizedAt,
      reason: 'doctor_left',
      requireActiveSession: false,
      regenerateSummary: true,
    });
  } catch (error) {
    // Never let summary finalization fail the leave-tracking response. Webhooks
    // and revoke remain as fallback triggers, and summary writes are idempotent.
    console.error('Failed to finalize consultation on doctor leave:', error);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TrackDoctorPresenceRequest;
    const roomName = body.roomName?.trim();
    const action = body.action;
    const doctorUserId = body.doctorUserId?.trim();
    const doctorName = body.doctorName?.trim() || null;
    const doctorEmail = body.doctorEmail?.trim().toLowerCase() || null;
    const preferredSessionId = body.consultationSessionId?.trim() || null;

    if (!roomName || !action || !doctorUserId) {
      return NextResponse.json(
        { success: false, error: 'roomName, action, and doctorUserId are required' },
        { status: 400 }
      );
    }

    if (action !== 'join' && action !== 'leave') {
      return NextResponse.json(
        { success: false, error: `Unsupported action: ${action}` },
        { status: 400 }
      );
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    const now = new Date();
    const roomPresenceRef = db.collection('roomDoctorPresence').doc(roomName);
    const roomPresenceDoc = await roomPresenceRef.get();
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
        return NextResponse.json({
          success: true,
          message: 'Doctor already active in room',
          consultationSessionId: activeDoctor?.consultationSessionId || null,
        });
      }

      const consultationSessionId = await resolveConsultationSessionId(db, roomName, preferredSessionId);
      activeDoctors[doctorUserId] = {
        joinedAt: now,
        doctorName,
        doctorEmail,
        consultationSessionId,
      };

      await roomPresenceRef.set(
        {
          roomName,
          activeDoctors,
          updatedAt: now,
        },
        { merge: true }
      );

      if (consultationSessionId) {
        await appendPresenceEvent(db, {
          consultationSessionId,
          roomName,
          doctorUserId,
          actorType: 'doctor',
          eventType: 'joined',
          eventAt: now,
          metadata: {
            doctorName,
            doctorEmail,
            source: 'doctor-presence-tracker',
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Doctor join tracked',
        consultationSessionId,
      });
    }

    const joinedAt = toDate(activeDoctor?.joinedAt);
    if (!joinedAt) {
      return NextResponse.json({
        success: true,
        message: 'Doctor was not marked active in this room',
      });
    }

    const segmentDurationMs = Math.max(0, now.getTime() - joinedAt.getTime());
    delete activeDoctors[doctorUserId];
    const lastLeftAtByDoctor = {
      ...((roomPresenceData.lastLeftAtByDoctor as Record<string, unknown> | undefined) || {}),
      [doctorUserId]: now,
    };
    await roomPresenceRef.set(
      {
        roomName,
        activeDoctors,
        updatedAt: now,
        lastLeftAtByDoctor,
      },
      { merge: true }
    );

    const consultationSessionId = await resolveConsultationSessionId(
      db,
      roomName,
      preferredSessionId || (typeof activeDoctor?.consultationSessionId === 'string' ? activeDoctor.consultationSessionId : null)
    );

    if (!consultationSessionId) {
      return NextResponse.json({
        success: true,
        message: 'Doctor leave tracked (no active consultation session to update)',
      });
    }

    const doctorDurationMinutes = await applyDoctorDurationToSession(db, {
      consultationSessionId,
      roomName,
      doctorUserId,
      segmentDurationMs,
      doctorName,
      doctorEmail,
    });

    await appendPresenceEvent(db, {
      consultationSessionId,
      roomName,
      doctorUserId,
      actorType: 'doctor',
      eventType: 'left',
      eventAt: now,
      metadata: {
        doctorName,
        doctorEmail,
        segmentDurationMs,
        doctorDurationMinutes,
        source: 'doctor-presence-tracker',
      },
    });

    // The doctor leaving the room is the canonical "consultation ended" event.
    // Finalize here so the AI summary is generated deterministically rather than
    // depending on revoke/expire/webhook side-paths. Idempotency is enforced inside
    // generateAndStoreConsultationSummary (metadata.aiSummaryGenerated / isEdited).
    const noActiveDoctorsRemain = Object.keys(activeDoctors).length === 0;
    if (noActiveDoctorsRemain) {
      await finalizeOnLastDoctorLeave(db, { roomName, finalizedAt: now });
    }

    return NextResponse.json({
      success: true,
      message: 'Doctor leave tracked',
      consultationSessionId,
      doctorDurationMinutes,
      finalDurationMinutes: doctorDurationMinutes,
    });
  } catch (error) {
    console.error('Track doctor presence error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to track doctor presence',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

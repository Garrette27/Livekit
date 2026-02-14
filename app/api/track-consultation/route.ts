import { NextResponse } from 'next/server';
import type {
  DocumentReference,
  Firestore,
} from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import {
  buildVisibleUserIds,
  choosePatientUserId,
  isKnownUserId,
} from '@/lib/consultations/identity-utils';
import { calculateDurationMinutes } from '@/lib/consultations/session-timing';
import { resolveLeaveSessionId } from '@/lib/consultations/consultation-session-store';
import { generateAndStoreConsultationSummary } from '@/lib/consultations/summary-service';
import { FirestoreConsultationSessionCore } from '@/lib/services/video-chat';

type ConsultationAction = 'join' | 'leave';

interface TrackConsultationRequest {
  roomName?: string;
  action?: ConsultationAction;
  patientName?: string;
  userId?: string;
  patientEmail?: string;
  consultationSessionId?: string;
}

interface DateLike {
  toDate?: () => Date;
  toMillis?: () => number;
}

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

  const maybeDateLike = value as DateLike;
  if (typeof maybeDateLike.toDate === 'function') {
    return maybeDateLike.toDate();
  }

  if (typeof maybeDateLike.toMillis === 'function') {
    return new Date(maybeDateLike.toMillis());
  }

  const parsed = new Date(value as string | number | Date);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

async function lookupDoctorUserId(
  db: Firestore,
  roomName: string
): Promise<string> {
  try {
    const roomDoc = await db.collection('rooms').doc(roomName).get();
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

async function isDoctorActiveInRoom(
  db: Firestore,
  roomName: string,
  doctorUserId: string
): Promise<boolean> {
  try {
    const presenceDoc = await db.collection('roomDoctorPresence').doc(roomName).get();
    if (!presenceDoc.exists) {
      return false;
    }

    const presenceData = presenceDoc.data() as Record<string, unknown>;
    const activeDoctors =
      (presenceData.activeDoctors as Record<string, { joinedAt?: unknown } | undefined> | undefined) || {};
    if (doctorUserId && activeDoctors[doctorUserId]) {
      return true;
    }

    return Object.values(activeDoctors).some((entry) => Boolean(entry?.joinedAt));
  } catch (error) {
    console.error('Error checking active doctor presence:', error);
    return false;
  }
}

function resolvePatientIdentity(params: {
    roomName: string;
    userId?: string;
    patientEmail?: string;
    doctorUserId: string;
    existingPatientUserId?: string | null;
    existingPatientEmail?: string | null;
    preferExistingKnownPatient?: boolean;
  }
): ResolvedPatientIdentity {
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

  if (preferExistingKnownPatient && !resolvedPatientEmail) {
    resolvedPatientEmail = existingPatientEmail || null;
  }

  return {
    patientUserId: preferExistingKnownPatient
      ? choosePatientUserId(resolvedPatientUserId, existingPatientUserId || null)
      : resolvedPatientUserId || 'anonymous',
    patientEmail: resolvedPatientEmail || null,
  };
}

async function loadTranscriptionData(
  db: Firestore,
  roomName: string
): Promise<any[] | null> {
  try {
    const callDoc = await db.collection('calls').doc(roomName).get();
    if (!callDoc.exists) {
      return null;
    }

    const callData = callDoc.data();
    const transcription = callData?.transcription;
    return Array.isArray(transcription) ? transcription : null;
  } catch (error) {
    console.error('Could not fetch transcription data:', error);
    return null;
  }
}

async function handleJoinEvent(
  db: Firestore,
  sessionCore: FirestoreConsultationSessionCore,
  params: {
    roomName: string;
    patientName: string;
    patientUserId: string;
    patientEmail: string | null;
    doctorUserId: string;
    consultationRef: DocumentReference;
    existingData: Record<string, any> | null;
  }
) {
  const {
    roomName,
    patientName,
    patientUserId,
    patientEmail,
    doctorUserId,
    consultationRef,
    existingData,
  } = params;

  const now = new Date();
  const existingPatientUserId = existingData?.patientUserId || existingData?.metadata?.patientUserId || null;
  const existingVisibleToUsers = existingData?.metadata?.visibleToUsers || [];
  const existingPatientEmail =
    (typeof existingData?.patientEmail === 'string' ? existingData.patientEmail : null)
    || (typeof existingData?.metadata?.patientEmail === 'string' ? existingData.metadata.patientEmail : null);
  const hasActiveDoctor = await isDoctorActiveInRoom(db, roomName, doctorUserId);
  const allowCompletedReuse = Boolean(
    hasActiveDoctor &&
    existingData?.status === 'completed' &&
    existingData?.consultationSessionId &&
    isKnownUserId(existingPatientUserId) &&
    isKnownUserId(patientUserId) &&
    existingPatientUserId === patientUserId &&
    patientEmail &&
    existingPatientEmail &&
    patientEmail.toLowerCase() === existingPatientEmail.toLowerCase()
  );

  const session = await sessionCore.startSession({
    roomName,
    doctorUserId,
    patientUserId,
    patientEmail,
    patientName,
    existingData,
    now,
    allowCompletedReuse,
  });

  await consultationRef.set(
    {
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
    },
    { merge: true }
  );

  return {
    consultationSessionId: session.sessionId,
  };
}

async function handleLeaveEvent(
  db: Firestore,
  sessionCore: FirestoreConsultationSessionCore,
  params: {
    roomName: string;
    patientName: string;
    patientUserId: string;
    patientEmail: string | null;
    doctorUserId: string;
    consultationRef: DocumentReference;
    existingData: Record<string, any> | null;
    preferredConsultationSessionId?: string;
  }
) {
  const {
    roomName,
    patientName,
    patientUserId,
    patientEmail,
    doctorUserId,
    consultationRef,
    existingData,
    preferredConsultationSessionId,
  } = params;

  if (!existingData) {
    return {
      consultationSessionId: null,
      durationMinutes: 0,
    };
  }

  const now = new Date();
  const consultationSessionId =
    preferredConsultationSessionId?.trim() ||
    resolveLeaveSessionId({
      roomName,
      existingData,
      now,
    });
  let sessionStartedAt = toDate(existingData.sessionStartedAt || existingData.joinedAt) || now;
  let doctorDurationFromSessionMinutes = 0;

  try {
    const sessionDoc = await db.collection('consultationSessions').doc(consultationSessionId).get();
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
  const durationMinutes = calculateDurationMinutes({
    startedAt: sessionStartedAt,
    endedAt: now,
  });
  const finalDurationMinutes = Math.max(durationMinutes, doctorDurationFromSessionMinutes);

  const existingVisibleToUsers = existingData.metadata?.visibleToUsers || [];

  await consultationRef.set(
    {
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
    },
    { merge: true }
  );

  await sessionCore.closeSession({
    sessionId: consultationSessionId,
    roomName,
    doctorUserId,
    patientUserId,
    sessionStartedAt,
    sessionEndedAt: now,
    eventType: 'left',
    actorType: 'patient',
    actorId: patientUserId,
    metadata: {
      source: 'track-consultation-leave',
      patientName,
      patientEmail,
      durationMinutes: finalDurationMinutes,
    },
  });

  const transcriptionData = await loadTranscriptionData(db, roomName);
  await generateAndStoreConsultationSummary({
    roomName,
    patientName: patientName || existingData.patientName || 'Unknown Patient',
    durationMinutes: finalDurationMinutes,
    userId: doctorUserId,
    consultationSessionId,
    transcriptionData,
    patientUserId,
    patientEmail,
  });

  return {
    consultationSessionId,
    durationMinutes: finalDurationMinutes,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TrackConsultationRequest;
    const roomName = body.roomName?.trim();
    const action = body.action;
    const patientName = body.patientName?.trim() || 'Unknown Patient';
    const userId = body.userId?.trim() || 'anonymous';
    const patientEmail = body.patientEmail?.trim().toLowerCase() || undefined;
    const preferredConsultationSessionId = body.consultationSessionId?.trim() || undefined;

    if (!roomName || !action) {
      return NextResponse.json(
        { success: false, error: 'roomName and action are required' },
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
    const sessionCore = new FirestoreConsultationSessionCore(db);

    const doctorUserId = await lookupDoctorUserId(db, roomName);

    // Doctor lifecycle events are tracked separately and should not overwrite patient consultation state.
    const isDoctorLifecycleEvent =
      Boolean(userId) && doctorUserId !== 'unknown' && userId === doctorUserId;
    if (isDoctorLifecycleEvent) {
      return NextResponse.json({
        success: true,
        message: 'Doctor lifecycle event ignored',
        roomName,
        action,
      });
    }

    const consultationRef = db.collection('consultations').doc(roomName);
    const consultationDoc = await consultationRef.get();
    const existingData = consultationDoc.exists ? (consultationDoc.data() as Record<string, any>) : null;

    const existingPatientUserId = existingData?.patientUserId || existingData?.metadata?.patientUserId || null;
    const existingPatientEmail = existingData?.patientEmail || existingData?.metadata?.patientEmail || null;

    const resolvedPatient = resolvePatientIdentity({
      roomName,
      userId,
      patientEmail,
      doctorUserId,
      existingPatientUserId,
      existingPatientEmail,
      preferExistingKnownPatient: action === 'leave',
    });

    if (action === 'join') {
      const joinResult = await handleJoinEvent(db, sessionCore, {
        roomName,
        patientName,
        patientUserId: resolvedPatient.patientUserId,
        patientEmail: resolvedPatient.patientEmail,
        doctorUserId,
        consultationRef,
        existingData,
      });

      return NextResponse.json({
        success: true,
        message: 'Consultation join tracked successfully',
        roomName,
        action,
        consultationSessionId: joinResult.consultationSessionId,
      });
    }

    const leaveResult = await handleLeaveEvent(db, sessionCore, {
      roomName,
      patientName,
      patientUserId: resolvedPatient.patientUserId,
      patientEmail: resolvedPatient.patientEmail,
      doctorUserId,
      consultationRef,
      existingData,
      preferredConsultationSessionId,
    });

    return NextResponse.json({
      success: true,
      message: 'Consultation leave tracked successfully',
      roomName,
      action,
      consultationSessionId: leaveResult.consultationSessionId,
      durationMinutes: leaveResult.durationMinutes,
    });
  } catch (error) {
    console.error('Track consultation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to track consultation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

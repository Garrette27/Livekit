import { NextResponse } from 'next/server';
import type {
  DocumentReference,
  Firestore,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import {
  buildVisibleUserIds,
  choosePatientUserId,
  isKnownUserId,
} from '@/lib/consultations/identity-utils';
import { calculateDurationMinutes } from '@/lib/consultations/session-timing';
import {
  appendPresenceEvent,
  resolveJoinSession,
  resolveLeaveSessionId,
  upsertSessionSnapshot,
} from '@/lib/consultations/consultation-session-store';
import { generateAndStoreConsultationSummary } from '@/lib/consultations/summary-service';

type ConsultationAction = 'join' | 'leave';

interface TrackConsultationRequest {
  roomName?: string;
  action?: ConsultationAction;
  patientName?: string;
  userId?: string;
  patientEmail?: string;
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

function getLatestByCreatedAt(docs: QueryDocumentSnapshot[]): QueryDocumentSnapshot | null {
  if (docs.length === 0) {
    return null;
  }

  return [...docs].sort((left, right) => {
    const leftMillis = toDate(left.data().createdAt)?.getTime() || 0;
    const rightMillis = toDate(right.data().createdAt)?.getTime() || 0;
    return rightMillis - leftMillis;
  })[0];
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

async function lookupUserIdByEmail(
  db: Firestore,
  email: string
): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  try {
    const querySnapshot = await db
      .collection('users')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return null;
    }

    return querySnapshot.docs[0].id;
  } catch (error) {
    console.error('Error looking up user by email:', error);
    return null;
  }
}

async function lookupLatestInvitationEmail(
  db: Firestore,
  roomName: string
): Promise<string | null> {
  try {
    const invitationsSnapshot = await db
      .collection('invitations')
      .where('roomName', '==', roomName)
      .limit(20)
      .get();

    if (invitationsSnapshot.empty) {
      return null;
    }

    const latestInvitationDoc = getLatestByCreatedAt(invitationsSnapshot.docs);
    if (!latestInvitationDoc) {
      return null;
    }

    const invitationData = latestInvitationDoc.data();
    const invitationEmail =
      invitationData?.emailAllowed ||
      invitationData?.metadata?.constraints?.email ||
      null;

    return invitationEmail ? String(invitationEmail).trim().toLowerCase() : null;
  } catch (error) {
    console.error('Error resolving invitation email:', error);
    return null;
  }
}

async function resolvePatientIdentity(
  db: Firestore,
  params: {
    roomName: string;
    userId?: string;
    patientEmail?: string;
    doctorUserId: string;
    existingPatientUserId?: string | null;
    existingPatientEmail?: string | null;
  }
): Promise<ResolvedPatientIdentity> {
  const {
    roomName,
    userId,
    patientEmail,
    doctorUserId,
    existingPatientUserId,
    existingPatientEmail,
  } = params;

  let resolvedPatientUserId = userId || 'anonymous';
  let resolvedPatientEmail: string | null = patientEmail?.trim().toLowerCase() || null;

  if (resolvedPatientUserId === doctorUserId) {
    resolvedPatientUserId = 'anonymous';
  }

  if (!isKnownUserId(resolvedPatientUserId) && resolvedPatientEmail) {
    const matchedUserId = await lookupUserIdByEmail(db, resolvedPatientEmail);
    if (matchedUserId && matchedUserId !== doctorUserId) {
      resolvedPatientUserId = matchedUserId;
    }
  }

  if (!isKnownUserId(resolvedPatientUserId) && !resolvedPatientEmail) {
    const invitationEmail = await lookupLatestInvitationEmail(db, roomName);
    if (invitationEmail) {
      resolvedPatientEmail = invitationEmail;
      const matchedUserId = await lookupUserIdByEmail(db, invitationEmail);
      if (matchedUserId && matchedUserId !== doctorUserId) {
        resolvedPatientUserId = matchedUserId;
      }
    }
  }

  return {
    patientUserId: choosePatientUserId(resolvedPatientUserId, existingPatientUserId || null),
    patientEmail: resolvedPatientEmail || existingPatientEmail || null,
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
  const existingJoinedAt = toDate(existingData?.joinedAt);

  const sessionResolution = resolveJoinSession({
    roomName,
    existingData,
    existingPatientUserId,
    nextPatientUserId: patientUserId,
    now,
  });

  const joinedAt = sessionResolution.reusedExistingSession && existingJoinedAt ? existingJoinedAt : now;

  await consultationRef.set(
    {
      roomName,
      patientName: patientName || existingData?.patientName || 'Unknown Patient',
      patientUserId,
      patientEmail,
      joinedAt,
      sessionStartedAt: sessionResolution.sessionStartedAt,
      consultationSessionId: sessionResolution.consultationSessionId,
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
        consultationSessionId: sessionResolution.consultationSessionId,
        visibleToUsers: buildVisibleUserIds(doctorUserId, patientUserId, existingVisibleToUsers),
      },
    },
    { merge: true }
  );

  await upsertSessionSnapshot(db, {
    consultationSessionId: sessionResolution.consultationSessionId,
    roomName,
    doctorUserId,
    patientUserId,
    status: 'active',
    sessionStartedAt: sessionResolution.sessionStartedAt,
    metadata: {
      source: 'track-consultation-join',
      patientName,
    },
  });

  await appendPresenceEvent(db, {
    consultationSessionId: sessionResolution.consultationSessionId,
    roomName,
    doctorUserId,
    patientUserId,
    actorType: 'patient',
    eventType: sessionResolution.eventType,
    eventAt: now,
    metadata: {
      patientName,
    },
  });

  return {
    consultationSessionId: sessionResolution.consultationSessionId,
  };
}

async function handleLeaveEvent(
  db: Firestore,
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

  if (!existingData) {
    return {
      consultationSessionId: null,
      durationMinutes: 0,
    };
  }

  const now = new Date();
  const sessionStartedAt = toDate(existingData.sessionStartedAt || existingData.joinedAt) || now;
  const consultationSessionId = resolveLeaveSessionId({
    roomName,
    existingData,
    now,
  });
  const durationMinutes = calculateDurationMinutes({
    startedAt: sessionStartedAt,
    endedAt: now,
  });

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
      duration: durationMinutes,
      status: 'completed',
      isRealConsultation: true,
      createdBy: doctorUserId,
      metadata: {
        ...(existingData.metadata || {}),
        source: 'patient_leave',
        trackedAt: now,
        durationMinutes,
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

  await upsertSessionSnapshot(db, {
    consultationSessionId,
    roomName,
    doctorUserId,
    patientUserId,
    status: 'completed',
    sessionStartedAt,
    sessionEndedAt: now,
    metadata: {
      source: 'track-consultation-leave',
      patientName,
      durationMinutes,
    },
  });

  await appendPresenceEvent(db, {
    consultationSessionId,
    roomName,
    doctorUserId,
    patientUserId,
    actorType: 'patient',
    eventType: 'left',
    eventAt: now,
    metadata: {
      patientName,
      durationMinutes,
    },
  });

  const transcriptionData = await loadTranscriptionData(db, roomName);
  await generateAndStoreConsultationSummary({
    roomName,
    patientName: patientName || existingData.patientName || 'Unknown Patient',
    durationMinutes,
    userId: doctorUserId,
    consultationSessionId,
    transcriptionData,
    patientUserId,
    patientEmail,
  });

  return {
    consultationSessionId,
    durationMinutes,
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

    const resolvedPatient = await resolvePatientIdentity(db, {
      roomName,
      userId,
      patientEmail,
      doctorUserId,
      existingPatientUserId,
      existingPatientEmail,
    });

    if (action === 'join') {
      const joinResult = await handleJoinEvent(db, {
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

    const leaveResult = await handleLeaveEvent(db, {
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

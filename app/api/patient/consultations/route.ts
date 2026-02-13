import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin, getFirebaseAdminAuth } from '@/lib/firebase-admin';

interface PatientConsultationSummary {
  id: string;
  roomName: string;
  createdAt: string | null;
  duration: number;
  doctorEmail?: string;
  patientEmail?: string;
  createdBy?: string;
  patientUserId?: string;
}

type TimestampLike = {
  toDate?: () => Date;
  toMillis?: () => number;
};

function toIsoString(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'object' && value !== null) {
    const timestampLike = value as TimestampLike;
    if (typeof timestampLike.toDate === 'function') {
      return timestampLike.toDate().toISOString();
    }
    if (typeof timestampLike.toMillis === 'function') {
      return new Date(timestampLike.toMillis()).toISOString();
    }
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

function normalizeDuration(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed);
}

function durationFromSessionData(sessionData: Record<string, unknown>): number {
  const sessionStartedAtIso = toIsoString(sessionData.sessionStartedAt || sessionData.createdAt);
  const sessionEndedAtIso = toIsoString(sessionData.sessionEndedAt);
  if (sessionStartedAtIso && sessionEndedAtIso) {
    const startedAt = Date.parse(sessionStartedAtIso);
    const endedAt = Date.parse(sessionEndedAtIso);
    if (!Number.isNaN(startedAt) && !Number.isNaN(endedAt) && endedAt >= startedAt) {
      return Math.max(0, Math.round((endedAt - startedAt) / 60000));
    }
  }

  const metadataDuration = (sessionData.metadata as { durationMinutes?: unknown } | undefined)?.durationMinutes;
  return normalizeDuration(metadataDuration);
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Authorization token required' }, { status: 401 });
    }

    const idToken = authHeader.slice(7);
    const adminAuth = getFirebaseAdminAuth();
    if (!adminAuth) {
      return NextResponse.json({ success: false, error: 'Firebase Admin auth not initialized' }, { status: 500 });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const patientUserId = decodedToken.uid;
    const rawPatientEmail = (decodedToken.email || '').trim();
    const patientEmail = rawPatientEmail.toLowerCase();

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 });
    }

    const emailCandidates = Array.from(
      new Set([patientEmail, rawPatientEmail].filter((value) => typeof value === 'string' && value.length > 0))
    );

    const userScopedSummaryQueries = [
      db.collection('call-summaries').where('patientUserId', '==', patientUserId).limit(200).get(),
      db.collection('call-summaries').where('metadata.patientUserId', '==', patientUserId).limit(200).get(),
    ];
    const emailScopedSummaryQueries = emailCandidates.flatMap((emailCandidate) => [
      db.collection('call-summaries').where('patientEmail', '==', emailCandidate).limit(200).get(),
      db.collection('call-summaries').where('metadata.patientEmail', '==', emailCandidate).limit(200).get(),
    ]);

    const userScopedSessionQueries = [
      db.collection('consultationSessions').where('patientUserId', '==', patientUserId).limit(200).get(),
      db.collection('consultationSessions').where('metadata.patientUserId', '==', patientUserId).limit(200).get(),
    ];
    const emailScopedSessionQueries = emailCandidates.flatMap((emailCandidate) => [
      db.collection('consultationSessions').where('patientEmail', '==', emailCandidate).limit(200).get(),
      db.collection('consultationSessions').where('metadata.patientEmail', '==', emailCandidate).limit(200).get(),
    ]);

    const [summarySnapshots, sessionSnapshots] = await Promise.all([
      Promise.all([...userScopedSummaryQueries, ...emailScopedSummaryQueries]),
      Promise.all([...userScopedSessionQueries, ...emailScopedSessionQueries]),
    ]);

    const summaryDocsById = new Map<string, any>();
    summarySnapshots.forEach((snapshot) => {
      snapshot.docs.forEach((summaryDoc) => summaryDocsById.set(summaryDoc.id, summaryDoc));
    });

    const sessionDocsById = new Map<string, any>();
    sessionSnapshots.forEach((snapshot) => {
      snapshot.docs.forEach((sessionDoc) => {
        const sessionData = sessionDoc.data() as Record<string, unknown>;
        const consultationSessionId =
          (typeof sessionData.consultationSessionId === 'string' && sessionData.consultationSessionId.trim())
            ? sessionData.consultationSessionId.trim()
            : sessionDoc.id;
        sessionDocsById.set(consultationSessionId, sessionDoc);
      });
    });

    const userEmailCache = new Map<string, string | undefined>();
    const resolveUserEmail = async (userId?: string): Promise<string | undefined> => {
      if (!userId) {
        return undefined;
      }

      if (userEmailCache.has(userId)) {
        return userEmailCache.get(userId);
      }

      try {
        const userDoc = await db.collection('users').doc(userId).get();
        const email = userDoc.exists ? (userDoc.data()?.email as string | undefined) : undefined;
        userEmailCache.set(userId, email);
        return email;
      } catch {
        userEmailCache.set(userId, undefined);
        return undefined;
      }
    };

    const outputById = new Map<string, PatientConsultationSummary>();

    const upsertSummary = (summary: PatientConsultationSummary) => {
      const existing = outputById.get(summary.id);
      if (!existing) {
        outputById.set(summary.id, summary);
        return;
      }

      outputById.set(summary.id, {
        ...existing,
        ...summary,
        roomName: summary.roomName || existing.roomName,
        createdAt: summary.createdAt || existing.createdAt,
        duration: Math.max(existing.duration, summary.duration),
        doctorEmail: summary.doctorEmail || existing.doctorEmail,
        patientEmail: summary.patientEmail || existing.patientEmail,
        createdBy: summary.createdBy || existing.createdBy,
        patientUserId: summary.patientUserId || existing.patientUserId,
      });
    };

    const summaryRecords = await Promise.all(
      Array.from(summaryDocsById.values()).map(async (summaryDoc) => {
        const summaryData = summaryDoc.data() as Record<string, unknown>;
        const doctorUserId =
          (summaryData.createdBy as string | undefined) ||
          ((summaryData.metadata as Record<string, unknown> | undefined)?.createdBy as string | undefined);
        const resolvedPatientUserId =
          (summaryData.patientUserId as string | undefined) ||
          ((summaryData.metadata as Record<string, unknown> | undefined)?.patientUserId as string | undefined);
        const doctorEmail =
          (summaryData.doctorEmail as string | undefined) || (await resolveUserEmail(doctorUserId));
        const resolvedPatientEmail =
          (summaryData.patientEmail as string | undefined) ||
          (await resolveUserEmail(resolvedPatientUserId)) ||
          decodedToken.email ||
          undefined;

        return {
          id: summaryDoc.id,
          roomName: (summaryData.roomName as string) || 'Unknown Room',
          createdAt: toIsoString(summaryData.createdAt),
          duration: normalizeDuration(summaryData.duration),
          doctorEmail,
          patientEmail: resolvedPatientEmail,
          createdBy: doctorUserId,
          patientUserId: resolvedPatientUserId,
        } satisfies PatientConsultationSummary;
      })
    );

    const sessionRecords = await Promise.all(
      Array.from(sessionDocsById.entries()).map(async ([consultationSessionId, sessionDoc]) => {
        const sessionData = sessionDoc.data() as Record<string, unknown>;
        const doctorUserId = sessionData.doctorUserId as string | undefined;
        const resolvedPatientUserId =
          (sessionData.patientUserId as string | undefined) ||
          ((sessionData.metadata as Record<string, unknown> | undefined)?.patientUserId as string | undefined);
        const doctorEmail = await resolveUserEmail(doctorUserId);
        const resolvedPatientEmail =
          (sessionData.patientEmail as string | undefined) ||
          ((sessionData.metadata as Record<string, unknown> | undefined)?.patientEmail as string | undefined) ||
          (await resolveUserEmail(resolvedPatientUserId)) ||
          decodedToken.email ||
          undefined;

        return {
          id: consultationSessionId,
          roomName: (sessionData.roomName as string) || 'Unknown Room',
          createdAt: toIsoString(sessionData.sessionStartedAt || sessionData.createdAt || sessionData.updatedAt),
          duration: durationFromSessionData(sessionData),
          doctorEmail,
          patientEmail: resolvedPatientEmail,
          createdBy: doctorUserId,
          patientUserId: resolvedPatientUserId,
        } satisfies PatientConsultationSummary;
      })
    );

    const sessionRoomNames = new Set(
      sessionRecords
        .map((record) => record.roomName.toLowerCase())
        .filter((roomName) => roomName.length > 0)
    );

    summaryRecords.forEach((summaryRecord) => {
      const isRoomScopedFallbackDoc = summaryRecord.id === summaryRecord.roomName;
      if (isRoomScopedFallbackDoc && sessionRoomNames.has(summaryRecord.roomName.toLowerCase())) {
        return;
      }
      upsertSummary(summaryRecord);
    });

    sessionRecords.forEach(upsertSummary);

    return NextResponse.json({
      success: true,
      summaries: Array.from(outputById.values()),
      count: outputById.size,
    });
  } catch (error) {
    console.error('Error fetching patient consultations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch patient consultations',
      },
      { status: 500 }
    );
  }
}

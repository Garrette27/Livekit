import type { Firestore } from 'firebase-admin/firestore';
import { isKnownUserId } from '@/lib/consultations/identity-utils';
import { generateAndStoreConsultationSummary } from '@/lib/consultations/summary-service';
import type { HistoryRecord, SummaryProjectionService } from './contracts';

interface TimestampLike {
  toDate?: () => Date;
  toMillis?: () => number;
}

function toIsoString(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
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
  const startedAtIso = toIsoString(sessionData.sessionStartedAt || sessionData.createdAt);
  const endedAtIso = toIsoString(sessionData.sessionEndedAt);
  if (startedAtIso && endedAtIso) {
    const startedAt = Date.parse(startedAtIso);
    const endedAt = Date.parse(endedAtIso);
    if (!Number.isNaN(startedAt) && !Number.isNaN(endedAt) && endedAt >= startedAt) {
      return Math.max(0, Math.round((endedAt - startedAt) / 60000));
    }
  }

  const metadataDuration = (sessionData.metadata as { durationMinutes?: unknown } | undefined)?.durationMinutes;
  return normalizeDuration(metadataDuration);
}

function mergeHistoryRecords(existing: HistoryRecord, incoming: HistoryRecord): HistoryRecord {
  return {
    ...existing,
    ...incoming,
    roomName: incoming.roomName || existing.roomName,
    createdAt: incoming.createdAt || existing.createdAt,
    duration: Math.max(existing.duration, incoming.duration),
    doctorEmail: incoming.doctorEmail || existing.doctorEmail,
    patientEmail: incoming.patientEmail || existing.patientEmail,
    createdBy: incoming.createdBy || existing.createdBy,
    patientUserId: incoming.patientUserId || existing.patientUserId,
    summary: incoming.summary || existing.summary,
    riskLevel: incoming.riskLevel || existing.riskLevel,
    category: incoming.category || existing.category,
    keyPoints:
      Array.isArray(incoming.keyPoints) && incoming.keyPoints.length > 0
        ? incoming.keyPoints
        : existing.keyPoints,
    recommendations:
      Array.isArray(incoming.recommendations) && incoming.recommendations.length > 0
        ? incoming.recommendations
        : existing.recommendations,
    followUpActions:
      Array.isArray(incoming.followUpActions) && incoming.followUpActions.length > 0
        ? incoming.followUpActions
        : existing.followUpActions,
  };
}

async function resolveUserEmail(
  db: Firestore,
  userEmailCache: Map<string, string | undefined>,
  userId?: string
): Promise<string | undefined> {
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
}

async function getSummaryDocsByDoctor(db: Firestore, doctorUserId: string) {
  const snapshot = await db
    .collection('call-summaries')
    .where('createdBy', '==', doctorUserId)
    .limit(300)
    .get();
  return snapshot.docs;
}

async function getSessionDocsByDoctor(db: Firestore, doctorUserId: string) {
  const snapshot = await db
    .collection('consultationSessions')
    .where('doctorUserId', '==', doctorUserId)
    .limit(300)
    .get();
  return snapshot.docs;
}

async function getSummaryDocsByPatient(
  db: Firestore,
  patientUserId: string,
  patientEmailCandidates: string[]
) {
  const userScopedQueries = [
    db.collection('call-summaries').where('patientUserId', '==', patientUserId).limit(300).get(),
    db.collection('call-summaries').where('metadata.patientUserId', '==', patientUserId).limit(300).get(),
  ];
  const emailScopedQueries = patientEmailCandidates.flatMap((email) => [
    db.collection('call-summaries').where('patientEmail', '==', email).limit(300).get(),
    db.collection('call-summaries').where('metadata.patientEmail', '==', email).limit(300).get(),
  ]);
  const snapshots = await Promise.all([...userScopedQueries, ...emailScopedQueries]);

  const docsById = new Map<string, (typeof snapshots)[number]['docs'][number]>();
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((doc) => docsById.set(doc.id, doc));
  });

  return Array.from(docsById.values());
}

async function getSessionDocsByPatient(
  db: Firestore,
  patientUserId: string,
  patientEmailCandidates: string[]
) {
  const userScopedQueries = [
    db.collection('consultationSessions').where('patientUserId', '==', patientUserId).limit(300).get(),
    db.collection('consultationSessions').where('metadata.patientUserId', '==', patientUserId).limit(300).get(),
  ];
  const emailScopedQueries = patientEmailCandidates.flatMap((email) => [
    db.collection('consultationSessions').where('patientEmail', '==', email).limit(300).get(),
    db.collection('consultationSessions').where('metadata.patientEmail', '==', email).limit(300).get(),
  ]);
  const snapshots = await Promise.all([...userScopedQueries, ...emailScopedQueries]);

  const docsBySessionId = new Map<string, (typeof snapshots)[number]['docs'][number]>();
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const sessionId =
        (typeof data.consultationSessionId === 'string' && data.consultationSessionId.trim())
          ? data.consultationSessionId.trim()
          : doc.id;
      docsBySessionId.set(sessionId, doc);
    });
  });

  return Array.from(docsBySessionId.entries()).map(([sessionId, doc]) => ({ sessionId, doc }));
}

function sortHistoryDescending(history: HistoryRecord[]): HistoryRecord[] {
  return [...history].sort((left, right) => {
    const leftMs = left.createdAt ? Date.parse(left.createdAt) : 0;
    const rightMs = right.createdAt ? Date.parse(right.createdAt) : 0;
    return rightMs - leftMs;
  });
}

export class FirestoreSummaryProjectionService implements SummaryProjectionService {
  constructor(private readonly db: Firestore) {}

  async buildSummary(input: {
    consultationSessionId: string;
    regenerate?: boolean;
  }): Promise<{ summaryId: string; summary: Record<string, unknown> | null }> {
    const consultationSessionId = input.consultationSessionId.trim();
    if (!consultationSessionId) {
      throw new Error('consultationSessionId is required');
    }

    const sessionDoc = await this.db.collection('consultationSessions').doc(consultationSessionId).get();
    if (!sessionDoc.exists) {
      throw new Error('Consultation session not found');
    }

    const sessionData = sessionDoc.data() as Record<string, unknown>;
    const summaryRef = this.db.collection('call-summaries').doc(consultationSessionId);
    const existingSummaryDoc = await summaryRef.get();

    if (!input.regenerate && existingSummaryDoc.exists) {
      return {
        summaryId: consultationSessionId,
        summary: existingSummaryDoc.data() as Record<string, unknown>,
      };
    }

    const roomName = (sessionData.roomName as string | undefined) || 'unknown-room';
    const doctorUserId =
      (sessionData.doctorUserId as string | undefined)
      || ((sessionData.metadata as { createdBy?: string } | undefined)?.createdBy as string | undefined)
      || 'unknown';
    const patientName =
      (sessionData.metadata as { patientName?: string } | undefined)?.patientName
      || (sessionData.patientUserId as string | undefined)
      || 'Patient';
    const durationMinutes = Math.max(
      normalizeDuration(sessionData.duration),
      durationFromSessionData(sessionData)
    );
    const patientUserId = isKnownUserId(sessionData.patientUserId as string | undefined)
      ? (sessionData.patientUserId as string)
      : null;
    const patientEmail =
      (sessionData.patientEmail as string | undefined)
      || ((sessionData.metadata as { patientEmail?: string } | undefined)?.patientEmail as string | undefined)
      || null;

    await generateAndStoreConsultationSummary({
      roomName,
      patientName,
      durationMinutes,
      userId: doctorUserId,
      consultationSessionId,
      patientUserId,
      patientEmail,
    });

    const rebuiltSummaryDoc = await summaryRef.get();
    return {
      summaryId: consultationSessionId,
      summary: rebuiltSummaryDoc.exists ? (rebuiltSummaryDoc.data() as Record<string, unknown>) : null,
    };
  }

  async buildDoctorHistory(doctorUserId: string): Promise<HistoryRecord[]> {
    const normalizedDoctorUserId = doctorUserId.trim();
    if (!normalizedDoctorUserId) {
      throw new Error('doctorUserId is required');
    }

    const [summaryDocs, sessionDocs] = await Promise.all([
      getSummaryDocsByDoctor(this.db, normalizedDoctorUserId),
      getSessionDocsByDoctor(this.db, normalizedDoctorUserId),
    ]);

    const historyById = new Map<string, HistoryRecord>();
    const userEmailCache = new Map<string, string | undefined>();
    const doctorEmail = await resolveUserEmail(this.db, userEmailCache, normalizedDoctorUserId);

    for (const summaryDoc of summaryDocs) {
      const summaryData = summaryDoc.data() as Record<string, unknown>;
      const patientUserId =
        (summaryData.patientUserId as string | undefined)
        || ((summaryData.metadata as { patientUserId?: string } | undefined)?.patientUserId as string | undefined);
      const patientEmail =
        (summaryData.patientEmail as string | undefined)
        || ((summaryData.metadata as { patientEmail?: string } | undefined)?.patientEmail as string | undefined)
        || (await resolveUserEmail(this.db, userEmailCache, patientUserId));
      const record: HistoryRecord = {
        id: summaryDoc.id,
        roomName: (summaryData.roomName as string) || 'Unknown Room',
        createdAt: toIsoString(summaryData.createdAt),
        duration: normalizeDuration(summaryData.duration),
        doctorEmail,
        patientEmail: patientEmail || undefined,
        createdBy: normalizedDoctorUserId,
        patientUserId: patientUserId || undefined,
        summary: (summaryData.summary as string | undefined) || undefined,
        riskLevel: (summaryData.riskLevel as string | undefined) || undefined,
        category: (summaryData.category as string | undefined) || undefined,
        keyPoints: Array.isArray(summaryData.keyPoints)
          ? (summaryData.keyPoints as string[])
          : undefined,
        recommendations: Array.isArray(summaryData.recommendations)
          ? (summaryData.recommendations as string[])
          : undefined,
        followUpActions: Array.isArray(summaryData.followUpActions)
          ? (summaryData.followUpActions as string[])
          : undefined,
      };

      const existing = historyById.get(record.id);
      historyById.set(record.id, existing ? mergeHistoryRecords(existing, record) : record);
    }

    for (const sessionDoc of sessionDocs) {
      const sessionData = sessionDoc.data() as Record<string, unknown>;
      const sessionId =
        (typeof sessionData.consultationSessionId === 'string' && sessionData.consultationSessionId.trim())
          ? sessionData.consultationSessionId.trim()
          : sessionDoc.id;
      const patientUserId =
        (sessionData.patientUserId as string | undefined)
        || ((sessionData.metadata as { patientUserId?: string } | undefined)?.patientUserId as string | undefined);
      const patientEmail =
        (sessionData.patientEmail as string | undefined)
        || ((sessionData.metadata as { patientEmail?: string } | undefined)?.patientEmail as string | undefined)
        || (await resolveUserEmail(this.db, userEmailCache, patientUserId));
      const record: HistoryRecord = {
        id: sessionId,
        roomName: (sessionData.roomName as string) || 'Unknown Room',
        createdAt: toIsoString(sessionData.sessionStartedAt || sessionData.createdAt || sessionData.updatedAt),
        duration: durationFromSessionData(sessionData),
        doctorEmail,
        patientEmail: patientEmail || undefined,
        createdBy: normalizedDoctorUserId,
        patientUserId: patientUserId || undefined,
      };

      const existing = historyById.get(record.id);
      historyById.set(record.id, existing ? mergeHistoryRecords(existing, record) : record);
    }

    return sortHistoryDescending(Array.from(historyById.values()));
  }

  async buildPatientHistory(input: {
    patientUserId: string;
    patientEmail?: string | null;
  }): Promise<HistoryRecord[]> {
    const patientUserId = input.patientUserId.trim();
    if (!patientUserId) {
      throw new Error('patientUserId is required');
    }

    const normalizedEmail = input.patientEmail?.trim().toLowerCase() || '';
    const patientEmailCandidates = Array.from(
      new Set([normalizedEmail, input.patientEmail?.trim() || ''].filter((value) => value.length > 0))
    );

    const [summaryDocs, sessionDocs] = await Promise.all([
      getSummaryDocsByPatient(this.db, patientUserId, patientEmailCandidates),
      getSessionDocsByPatient(this.db, patientUserId, patientEmailCandidates),
    ]);

    const historyById = new Map<string, HistoryRecord>();
    const userEmailCache = new Map<string, string | undefined>();

    for (const summaryDoc of summaryDocs) {
      const summaryData = summaryDoc.data() as Record<string, unknown>;
      const doctorUserId =
        (summaryData.createdBy as string | undefined)
        || ((summaryData.metadata as { createdBy?: string } | undefined)?.createdBy as string | undefined);
      const resolvedPatientUserId =
        (summaryData.patientUserId as string | undefined)
        || ((summaryData.metadata as { patientUserId?: string } | undefined)?.patientUserId as string | undefined);
      const doctorEmail = await resolveUserEmail(this.db, userEmailCache, doctorUserId);
      const patientEmail =
        (summaryData.patientEmail as string | undefined)
        || ((summaryData.metadata as { patientEmail?: string } | undefined)?.patientEmail as string | undefined)
        || input.patientEmail
        || undefined;

      const record: HistoryRecord = {
        id: summaryDoc.id,
        roomName: (summaryData.roomName as string) || 'Unknown Room',
        createdAt: toIsoString(summaryData.createdAt),
        duration: normalizeDuration(summaryData.duration),
        doctorEmail: doctorEmail || undefined,
        patientEmail: patientEmail || undefined,
        createdBy: doctorUserId,
        patientUserId: resolvedPatientUserId,
        summary: (summaryData.summary as string | undefined) || undefined,
        riskLevel: (summaryData.riskLevel as string | undefined) || undefined,
        category: (summaryData.category as string | undefined) || undefined,
        keyPoints: Array.isArray(summaryData.keyPoints)
          ? (summaryData.keyPoints as string[])
          : undefined,
        recommendations: Array.isArray(summaryData.recommendations)
          ? (summaryData.recommendations as string[])
          : undefined,
        followUpActions: Array.isArray(summaryData.followUpActions)
          ? (summaryData.followUpActions as string[])
          : undefined,
      };

      const existing = historyById.get(record.id);
      historyById.set(record.id, existing ? mergeHistoryRecords(existing, record) : record);
    }

    const sessionRoomNames = new Set<string>();
    for (const { sessionId, doc } of sessionDocs) {
      const sessionData = doc.data() as Record<string, unknown>;
      const doctorUserId = (sessionData.doctorUserId as string | undefined) || undefined;
      const resolvedPatientUserId =
        (sessionData.patientUserId as string | undefined)
        || ((sessionData.metadata as { patientUserId?: string } | undefined)?.patientUserId as string | undefined);
      const doctorEmail = await resolveUserEmail(this.db, userEmailCache, doctorUserId);
      const patientEmail =
        (sessionData.patientEmail as string | undefined)
        || ((sessionData.metadata as { patientEmail?: string } | undefined)?.patientEmail as string | undefined)
        || input.patientEmail
        || undefined;

      const record: HistoryRecord = {
        id: sessionId,
        roomName: (sessionData.roomName as string) || 'Unknown Room',
        createdAt: toIsoString(sessionData.sessionStartedAt || sessionData.createdAt || sessionData.updatedAt),
        duration: durationFromSessionData(sessionData),
        doctorEmail: doctorEmail || undefined,
        patientEmail: patientEmail || undefined,
        createdBy: doctorUserId,
        patientUserId: resolvedPatientUserId,
      };
      sessionRoomNames.add(record.roomName.toLowerCase());

      const existing = historyById.get(record.id);
      historyById.set(record.id, existing ? mergeHistoryRecords(existing, record) : record);
    }

    const filteredHistory = Array.from(historyById.values()).filter((record) => {
      const isRoomScopedSummaryDoc = Boolean(record.summary) && record.id === record.roomName;
      if (!isRoomScopedSummaryDoc) {
        return true;
      }
      return !sessionRoomNames.has(record.roomName.toLowerCase());
    });

    return sortHistoryDescending(filteredHistory);
  }
}

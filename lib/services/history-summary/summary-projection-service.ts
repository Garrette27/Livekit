import type { Firestore } from 'firebase-admin/firestore';
import { isKnownUserId } from '@/lib/consultations/identity-utils';
import { generateAndStoreConsultationSummary } from '@/lib/services/consultation-finalization';
import { CallSummaryRepository } from '@/lib/repositories/call-summary-repository';
import { ConsultationSessionRepository } from '@/lib/repositories/consultation-session-repository';
import { UserRepository } from '@/lib/repositories/user-repository';
import type {
  HistoryChatMessageRecord,
  HistoryChatRecord,
  HistoryRecord,
  SummaryProjectionService,
  WaitingRoomHistoryRecord,
  WaitingRoomParticipantHistoryRecord,
} from './contracts';

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
  const mergedWaitingRoomHistory =
    (incoming.waitingRoomHistory && incoming.waitingRoomHistory.totalParticipants > 0)
      ? incoming.waitingRoomHistory
      : existing.waitingRoomHistory;
  const mergedChatHistory = mergeChatHistory(existing.chatHistory, incoming.chatHistory);

  return {
    ...existing,
    ...incoming,
    roomName: incoming.roomName || existing.roomName,
    createdAt: incoming.createdAt || existing.createdAt,
    startedAt: incoming.startedAt || existing.startedAt || null,
    endedAt: incoming.endedAt || existing.endedAt || null,
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
    waitingRoomHistory: mergedWaitingRoomHistory,
    chatHistory: mergedChatHistory,
  };
}

function isCompletedSession(sessionData: Record<string, unknown>): boolean {
  const status = typeof sessionData.status === 'string' ? sessionData.status.trim().toLowerCase() : '';
  if (status === 'completed') {
    return true;
  }

  const metadata = (sessionData.metadata as Record<string, unknown> | undefined) || {};
  return Boolean(toIsoString(sessionData.sessionEndedAt || metadata.sessionEndedAt));
}

function toFiniteNonNegativeNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed);
}

function normalizeWaitingRoomParticipant(value: unknown): WaitingRoomParticipantHistoryRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const waitingPatientId = typeof raw.waitingPatientId === 'string' ? raw.waitingPatientId : '';
  if (!waitingPatientId) {
    return null;
  }

  const status = raw.status;
  const normalizedStatus: WaitingRoomParticipantHistoryRecord['status'] =
    status === 'admitted' || status === 'left' || status === 'rejected' ? status : 'waiting';

  const waitingDurationMinutesRaw = raw.waitingDurationMinutes;
  const waitingDurationMinutes =
    waitingDurationMinutesRaw === null || typeof waitingDurationMinutesRaw === 'undefined'
      ? null
      : toFiniteNonNegativeNumber(waitingDurationMinutesRaw);

  return {
    waitingPatientId,
    invitationId: typeof raw.invitationId === 'string' ? raw.invitationId : null,
    displayName: typeof raw.displayName === 'string' ? raw.displayName : 'Anonymous Patient',
    patientEmail: typeof raw.patientEmail === 'string' ? raw.patientEmail : null,
    isAnonymous: Boolean(raw.isAnonymous),
    status: normalizedStatus,
    joinedAt: toIsoString(raw.joinedAt),
    admittedAt: toIsoString(raw.admittedAt),
    leftAt: toIsoString(raw.leftAt),
    removedAt: toIsoString(raw.removedAt),
    waitingDurationMinutes,
  };
}

function normalizeWaitingRoomHistory(value: unknown): WaitingRoomHistoryRecord | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const participants = Array.isArray(raw.participants)
    ? raw.participants
        .map((participant) => normalizeWaitingRoomParticipant(participant))
        .filter((participant): participant is WaitingRoomParticipantHistoryRecord => Boolean(participant))
    : [];

  const participantEmails = Array.from(
    new Set(
      participants
        .map((participant) => participant.patientEmail)
        .filter((patientEmail): patientEmail is string => Boolean(patientEmail))
    )
  );

  const anonymousParticipantCount = participants.filter((participant) => participant.isAnonymous).length;
  const registeredParticipantCount = participants.length - anonymousParticipantCount;
  const totalParticipantsRaw = Number(raw.totalParticipants);
  const totalParticipants = Number.isFinite(totalParticipantsRaw) && totalParticipantsRaw > 0
    ? Math.round(totalParticipantsRaw)
    : participants.length;

  if (participants.length === 0 && totalParticipants === 0 && participantEmails.length === 0) {
    return undefined;
  }

  return {
    totalParticipants: Math.max(totalParticipants, participants.length),
    registeredParticipantCount,
    anonymousParticipantCount,
    participantEmails,
    participants,
  };
}

function normalizeChatMessage(value: unknown): HistoryChatMessageRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id : '';
  const senderId = typeof raw.senderId === 'string' ? raw.senderId : '';
  const senderName = typeof raw.senderName === 'string' ? raw.senderName : '';
  const senderTypeRaw = raw.senderType;
  const senderType: HistoryChatMessageRecord['senderType'] =
    senderTypeRaw === 'doctor' || senderTypeRaw === 'patient' || senderTypeRaw === 'system'
      ? senderTypeRaw
      : 'system';
  const text = typeof raw.text === 'string' ? raw.text : '';
  const createdAt = toIsoString(raw.createdAt);

  if (!id || !senderId || !senderName) {
    return null;
  }

  return {
    id,
    senderId,
    senderName,
    senderType,
    text,
    createdAt,
  };
}

function normalizeChatHistory(value: unknown): HistoryChatRecord | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const messages = Array.isArray(raw.messages)
    ? raw.messages
        .map((message) => normalizeChatMessage(message))
        .filter((message): message is HistoryChatMessageRecord => Boolean(message))
    : [];

  const participants = Array.from(
    new Set(
      messages
        .map((message) => message.senderName)
        .filter((senderName) => senderName.trim().length > 0)
    )
  );

  const firstMessageAt =
    messages.length > 0
      ? messages[0].createdAt
      : toIsoString(raw.firstMessageAt);
  const lastMessageAt =
    messages.length > 0
      ? messages[messages.length - 1].createdAt
      : toIsoString(raw.lastMessageAt);
  const totalMessagesRaw = Number(raw.totalMessages);
  const totalMessages = Number.isFinite(totalMessagesRaw) && totalMessagesRaw >= 0
    ? Math.round(totalMessagesRaw)
    : messages.length;

  if (messages.length === 0 && totalMessages === 0) {
    return undefined;
  }

  return {
    totalMessages: Math.max(totalMessages, messages.length),
    firstMessageAt,
    lastMessageAt,
    participants,
    messages,
  };
}

function mergeChatHistory(
  existing?: HistoryChatRecord,
  incoming?: HistoryChatRecord
): HistoryChatRecord | undefined {
  if (!incoming) {
    return existing;
  }
  if (!existing) {
    return incoming;
  }

  if (incoming.totalMessages > 0) {
    return incoming;
  }

  return existing;
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
    const email = await new UserRepository(db).getEmail(userId);
    userEmailCache.set(userId, email);
    return email;
  } catch {
    userEmailCache.set(userId, undefined);
    return undefined;
  }
}

async function getSummaryDocsByDoctor(db: Firestore, doctorUserId: string) {
  return new CallSummaryRepository(db).findByDoctor(doctorUserId, 300);
}

async function getSessionDocsByDoctor(db: Firestore, doctorUserId: string) {
  return new ConsultationSessionRepository(db).findByDoctor(doctorUserId, 300);
}

async function getSummaryDocsByPatient(
  db: Firestore,
  patientUserId: string,
  patientEmailCandidates: string[]
) {
  return new CallSummaryRepository(db).findByPatient(
    { patientUserId, emails: patientEmailCandidates },
    300
  );
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

function toChatSenderType(value: unknown): HistoryChatMessageRecord['senderType'] {
  if (value === 'doctor' || value === 'patient' || value === 'system') {
    return value;
  }
  return 'system';
}

async function loadSessionChatHistory(
  db: Firestore,
  consultationSessionId: string
): Promise<HistoryChatRecord | undefined> {
  try {
    const snapshot = await db
      .collection('consultationSessions')
      .doc(consultationSessionId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .limit(500)
      .get();

    if (snapshot.empty) {
      return undefined;
    }

    const messages: HistoryChatMessageRecord[] = snapshot.docs.map((messageDoc) => {
      const messageData = messageDoc.data() as Record<string, unknown>;
      return {
        id: messageDoc.id,
        senderId: typeof messageData.senderId === 'string' ? messageData.senderId : 'unknown',
        senderName: typeof messageData.senderName === 'string' ? messageData.senderName : 'Unknown',
        senderType: toChatSenderType(messageData.senderType),
        text: typeof messageData.text === 'string' ? messageData.text : '',
        createdAt: toIsoString(messageData.createdAt || messageData.createdAtIso),
      };
    });

    const participants = Array.from(
      new Set(
        messages
          .map((message) => message.senderName)
          .filter((senderName) => senderName.trim().length > 0)
      )
    );

    return {
      totalMessages: messages.length,
      firstMessageAt: messages[0]?.createdAt || null,
      lastMessageAt: messages[messages.length - 1]?.createdAt || null,
      participants,
      messages,
    };
  } catch (chatHistoryError) {
    console.warn('Failed to load chat history for session:', {
      consultationSessionId,
      error: chatHistoryError instanceof Error ? chatHistoryError.message : chatHistoryError,
    });
    return undefined;
  }
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

    const sessionDoc = await new ConsultationSessionRepository(this.db).getById(consultationSessionId);
    if (!sessionDoc.exists) {
      throw new Error('Consultation session not found');
    }

    const sessionData = sessionDoc.data() as Record<string, unknown>;
    const summaryRepo = new CallSummaryRepository(this.db);
    const existingSummaryDoc = await summaryRepo.getById(consultationSessionId);

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

    const rebuiltSummaryDoc = await summaryRepo.getById(consultationSessionId);
    return {
      summaryId: consultationSessionId,
      summary: rebuiltSummaryDoc.exists ? (rebuiltSummaryDoc.data() as Record<string, unknown>) : null,
    };
  }

  async buildDoctorHistory(input: {
    doctorUserId: string;
    includeChatHistory?: boolean;
  }): Promise<HistoryRecord[]> {
    const normalizedDoctorUserId = input.doctorUserId.trim();
    const includeChatHistory = input.includeChatHistory === true;
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
      const summaryMetadata = (summaryData.metadata as Record<string, unknown> | undefined) || {};
      const patientUserId =
        (summaryData.patientUserId as string | undefined)
        || (summaryMetadata.patientUserId as string | undefined);
      const patientEmail =
        (summaryData.patientEmail as string | undefined)
        || (summaryMetadata.patientEmail as string | undefined)
        || (await resolveUserEmail(this.db, userEmailCache, patientUserId));
      const waitingRoomHistory = normalizeWaitingRoomHistory(
        summaryData.waitingRoomHistory || summaryMetadata.waitingRoomHistory
      );
      const chatHistory = normalizeChatHistory(
        summaryData.chatHistory || summaryMetadata.chatHistory
      );
      const record: HistoryRecord = {
        id: summaryDoc.id,
        roomName: (summaryData.roomName as string) || 'Unknown Room',
        createdAt: toIsoString(summaryData.createdAt),
        startedAt: toIsoString(summaryData.startedAt || summaryMetadata.sessionStartedAt),
        endedAt: toIsoString(summaryData.endedAt || summaryMetadata.sessionEndedAt),
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
        waitingRoomHistory,
        chatHistory,
      };

      const existing = historyById.get(record.id);
      historyById.set(record.id, existing ? mergeHistoryRecords(existing, record) : record);
    }

    for (const sessionDoc of sessionDocs) {
      const sessionData = sessionDoc.data() as Record<string, unknown>;
      if (!isCompletedSession(sessionData)) {
        continue;
      }
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
      const sessionMetadata = (sessionData.metadata as Record<string, unknown> | undefined) || {};
      const waitingRoomHistory = normalizeWaitingRoomHistory(sessionMetadata.waitingRoomHistory);
      const chatHistory = normalizeChatHistory(sessionMetadata.chatHistory);
      const startedAt = toIsoString(sessionData.sessionStartedAt || sessionData.createdAt || sessionData.updatedAt);
      const endedAt = toIsoString(
        sessionData.sessionEndedAt
        || (sessionMetadata.sessionEndedAt as unknown)
      );
      const record: HistoryRecord = {
        id: sessionId,
        roomName: (sessionData.roomName as string) || 'Unknown Room',
        createdAt: startedAt,
        startedAt,
        endedAt,
        duration: durationFromSessionData(sessionData),
        doctorEmail,
        patientEmail: patientEmail || undefined,
        createdBy: normalizedDoctorUserId,
        patientUserId: patientUserId || undefined,
        waitingRoomHistory,
        chatHistory,
      };

      const existing = historyById.get(record.id);
      historyById.set(record.id, existing ? mergeHistoryRecords(existing, record) : record);
    }

    const history = Array.from(historyById.values());
    if (!includeChatHistory) {
      return sortHistoryDescending(history);
    }

    const chatHistoryPairs = await Promise.all(
      history.map(async (record) => {
        const chatHistory = await loadSessionChatHistory(this.db, record.id);
        return {
          id: record.id,
          chatHistory: mergeChatHistory(record.chatHistory, chatHistory),
        };
      })
    );
    const chatHistoryById = new Map(
      chatHistoryPairs.map((pair) => [pair.id, pair.chatHistory])
    );

    return sortHistoryDescending(
      history.map((record) => ({
        ...record,
        chatHistory: chatHistoryById.get(record.id) || record.chatHistory,
      }))
    );
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
      const summaryMetadata = (summaryData.metadata as Record<string, unknown> | undefined) || {};
      const doctorUserId =
        (summaryData.createdBy as string | undefined)
        || (summaryMetadata.createdBy as string | undefined);
      const resolvedPatientUserId =
        (summaryData.patientUserId as string | undefined)
        || (summaryMetadata.patientUserId as string | undefined);
      const doctorEmail = await resolveUserEmail(this.db, userEmailCache, doctorUserId);
      const patientEmail =
        (summaryData.patientEmail as string | undefined)
        || (summaryMetadata.patientEmail as string | undefined)
        || input.patientEmail
        || undefined;
      const waitingRoomHistory = normalizeWaitingRoomHistory(
        summaryData.waitingRoomHistory || summaryMetadata.waitingRoomHistory
      );

      const record: HistoryRecord = {
        id: summaryDoc.id,
        roomName: (summaryData.roomName as string) || 'Unknown Room',
        createdAt: toIsoString(summaryData.createdAt),
        startedAt: toIsoString(summaryData.startedAt || summaryMetadata.sessionStartedAt),
        endedAt: toIsoString(summaryData.endedAt || summaryMetadata.sessionEndedAt),
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
        waitingRoomHistory,
      };

      const existing = historyById.get(record.id);
      historyById.set(record.id, existing ? mergeHistoryRecords(existing, record) : record);
    }

    const sessionRoomNames = new Set<string>();
    for (const { sessionId, doc } of sessionDocs) {
      const sessionData = doc.data() as Record<string, unknown>;
      if (!isCompletedSession(sessionData)) {
        continue;
      }
      const sessionMetadata = (sessionData.metadata as Record<string, unknown> | undefined) || {};
      const doctorUserId = (sessionData.doctorUserId as string | undefined) || undefined;
      const resolvedPatientUserId =
        (sessionData.patientUserId as string | undefined)
        || (sessionMetadata.patientUserId as string | undefined);
      const doctorEmail = await resolveUserEmail(this.db, userEmailCache, doctorUserId);
      const patientEmail =
        (sessionData.patientEmail as string | undefined)
        || (sessionMetadata.patientEmail as string | undefined)
        || input.patientEmail
        || undefined;
      const waitingRoomHistory = normalizeWaitingRoomHistory(sessionMetadata.waitingRoomHistory);

      const startedAt = toIsoString(sessionData.sessionStartedAt || sessionData.createdAt || sessionData.updatedAt);
      const endedAt = toIsoString(
        sessionData.sessionEndedAt
        || (sessionMetadata.sessionEndedAt as unknown)
      );
      const record: HistoryRecord = {
        id: sessionId,
        roomName: (sessionData.roomName as string) || 'Unknown Room',
        createdAt: startedAt,
        startedAt,
        endedAt,
        duration: durationFromSessionData(sessionData),
        doctorEmail: doctorEmail || undefined,
        patientEmail: patientEmail || undefined,
        createdBy: doctorUserId,
        patientUserId: resolvedPatientUserId,
        waitingRoomHistory,
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

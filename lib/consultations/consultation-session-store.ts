import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import { isKnownUserId } from './identity-utils';
import { EVENT_DOMAINS, EVENT_SCHEMA_VERSION } from '../events/event-schema';

export type ConsultationPresenceEventType =
  | 'joined'
  | 'left'
  | 'rejoined'
  | 'admitted_to_consultation'
  | 'patient_removed_by_doctor';
export type SessionChatVisibilityPolicy = 'join-time-only' | 'full-history';

interface DateLike {
  toDate?: () => Date;
  toMillis?: () => number;
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

function sanitizeRoomName(roomName: string): string {
  const normalized = roomName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return normalized || 'room';
}

function randomToken(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Build a stable session id for a single consultation encounter.
 * This id is separate from room name so multiple encounters in one room remain distinct.
 */
export function createConsultationSessionId(roomName: string, now: Date = new Date()): string {
  return `sess_${sanitizeRoomName(roomName)}_${now.getTime()}_${randomToken()}`;
}

interface ResolveJoinSessionInput {
  roomName: string;
  existingData?: Record<string, any> | null;
  existingPatientUserId?: string | null;
  nextPatientUserId?: string | null;
  allowCompletedReuse?: boolean;
  now?: Date;
  reconnectWindowMinutes?: number;
  completedReuseWindowMinutes?: number;
}

interface ResolveJoinSessionResult {
  consultationSessionId: string;
  sessionStartedAt: Date;
  eventType: ConsultationPresenceEventType;
  reusedExistingSession: boolean;
}

/**
 * Resolve whether to reuse an active session or create a new encounter session.
 * Reuse is only allowed for short reconnects for the same known patient.
 */
export function resolveJoinSession({
  roomName,
  existingData,
  existingPatientUserId,
  nextPatientUserId,
  allowCompletedReuse = false,
  now = new Date(),
  reconnectWindowMinutes = 5,
  completedReuseWindowMinutes = 60,
}: ResolveJoinSessionInput): ResolveJoinSessionResult {
  const existingSessionId =
    typeof existingData?.consultationSessionId === 'string' && existingData.consultationSessionId
      ? existingData.consultationSessionId
      : null;
  const existingStatus = existingData?.status;
  const existingLeftAt = toDate(existingData?.leftAt);
  const existingJoinedAt = toDate(existingData?.joinedAt);
  const existingSessionStartedAt = toDate(existingData?.sessionStartedAt) || existingJoinedAt;

  const isSameKnownPatient =
    isKnownUserId(existingPatientUserId) &&
    isKnownUserId(nextPatientUserId) &&
    existingPatientUserId === nextPatientUserId;

  const minutesSinceJoined = existingJoinedAt
    ? (now.getTime() - existingJoinedAt.getTime()) / (1000 * 60)
    : Number.POSITIVE_INFINITY;
  const minutesSinceLeft = existingLeftAt
    ? (now.getTime() - existingLeftAt.getTime()) / (1000 * 60)
    : Number.POSITIVE_INFINITY;

  const canReuseExistingSession =
    Boolean(existingSessionId) &&
    existingStatus === 'active' &&
    !existingLeftAt &&
    isSameKnownPatient &&
    Number.isFinite(minutesSinceJoined) &&
    minutesSinceJoined <= reconnectWindowMinutes &&
    Boolean(existingSessionStartedAt);

  const canReuseCompletedSession =
    Boolean(existingSessionId) &&
    allowCompletedReuse &&
    existingStatus === 'completed' &&
    isSameKnownPatient &&
    Boolean(existingLeftAt) &&
    Number.isFinite(minutesSinceLeft) &&
    minutesSinceLeft <= completedReuseWindowMinutes &&
    Boolean(existingSessionStartedAt);

  if (canReuseExistingSession || canReuseCompletedSession) {
    return {
      consultationSessionId: existingSessionId as string,
      sessionStartedAt: existingSessionStartedAt as Date,
      eventType: 'rejoined',
      reusedExistingSession: true,
    };
  }

  return {
    consultationSessionId: createConsultationSessionId(roomName, now),
    sessionStartedAt: now,
    eventType: 'joined',
    reusedExistingSession: false,
  };
}

interface ResolveLeaveSessionIdInput {
  roomName: string;
  existingData?: Record<string, any> | null;
  now?: Date;
}

/**
 * Resolve a session id for leave events. Reuses current session id if available.
 */
export function resolveLeaveSessionId({
  roomName,
  existingData,
  now = new Date(),
}: ResolveLeaveSessionIdInput): string {
  const existingSessionId =
    typeof existingData?.consultationSessionId === 'string' && existingData.consultationSessionId
      ? existingData.consultationSessionId
      : null;

  if (existingSessionId) {
    return existingSessionId;
  }

  const seed = toDate(existingData?.sessionStartedAt) || toDate(existingData?.joinedAt) || now;
  return createConsultationSessionId(roomName, seed);
}

interface UpsertSessionSnapshotInput {
  consultationSessionId: string;
  roomName: string;
  doctorUserId?: string | null;
  patientUserId?: string | null;
  status: 'active' | 'completed';
  sessionStartedAt: Date;
  sessionEndedAt?: Date | null;
  chatVisibilityPolicy?: SessionChatVisibilityPolicy;
  metadata?: Record<string, unknown>;
}

/**
 * Maintain a session snapshot document while preserving immutable history in events.
 */
export async function upsertSessionSnapshot(
  db: Firestore,
  {
    consultationSessionId,
    roomName,
    doctorUserId,
    patientUserId,
    status,
    sessionStartedAt,
    sessionEndedAt = null,
    chatVisibilityPolicy = 'join-time-only',
    metadata = {},
  }: UpsertSessionSnapshotInput
): Promise<void> {
  const sessionRef = db.collection('consultationSessions').doc(consultationSessionId);
  const updateData: Record<string, unknown> = {
    consultationSessionId,
    roomName,
    doctorUserId: doctorUserId || null,
    patientUserId: patientUserId || null,
    status,
    sessionStartedAt: Timestamp.fromDate(sessionStartedAt),
    chatVisibilityPolicy,
    metadata: {
      ...metadata,
      updatedAt: new Date().toISOString(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (sessionEndedAt) {
    updateData.sessionEndedAt = Timestamp.fromDate(sessionEndedAt);
  }

  await sessionRef.set(updateData, { merge: true });
}

interface AppendPresenceEventInput {
  consultationSessionId: string;
  roomName: string;
  doctorUserId?: string | null;
  patientUserId?: string | null;
  actorType: 'patient' | 'doctor' | 'system';
  actorId?: string | null;
  eventType: ConsultationPresenceEventType;
  eventAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Append immutable presence event for lifecycle timeline reconstruction.
 */
export async function appendPresenceEvent(
  db: Firestore,
  {
    consultationSessionId,
    roomName,
    doctorUserId,
    patientUserId,
    actorType,
    actorId = null,
    eventType,
    eventAt = new Date(),
    metadata = {},
  }: AppendPresenceEventInput
): Promise<void> {
  const eventsRef = db
    .collection('consultationSessions')
    .doc(consultationSessionId)
    .collection('events');

  await eventsRef.add({
    eventDomain: EVENT_DOMAINS.CONSULTATION_PRESENCE,
    eventVersion: EVENT_SCHEMA_VERSION,
    consultationSessionId,
    roomName,
    doctorUserId: doctorUserId || null,
    patientUserId: patientUserId || null,
    actorType,
    actorId,
    eventType,
    occurredAt: Timestamp.fromDate(eventAt),
    eventAt: Timestamp.fromDate(eventAt),
    metadata,
    createdAt: FieldValue.serverTimestamp(),
  });
}

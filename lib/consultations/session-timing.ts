import { isKnownUserId } from './identity-utils';

const DEFAULT_RECONNECT_WINDOW_MINUTES = 5;
const DEFAULT_MAX_DURATION_MINUTES = 12 * 60;

type DateLike = Date | { toDate?: () => Date } | { toMillis?: () => number } | string | number | null | undefined;

function toDate(value: DateLike): Date | null {
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
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

interface JoinTimingInput {
  existingData: Record<string, any> | null | undefined;
  existingPatientUserId: string | null | undefined;
  nextPatientUserId: string | null | undefined;
  now?: Date;
  reconnectWindowMinutes?: number;
}

interface JoinTimingResult {
  joinedAt: Date;
  sessionStartedAt: Date;
  reusedExistingStart: boolean;
}

export function resolveJoinTiming({
  existingData,
  existingPatientUserId,
  nextPatientUserId,
  now = new Date(),
  reconnectWindowMinutes = DEFAULT_RECONNECT_WINDOW_MINUTES,
}: JoinTimingInput): JoinTimingResult {
  if (!existingData) {
    return {
      joinedAt: now,
      sessionStartedAt: now,
      reusedExistingStart: false,
    };
  }

  const existingJoinedAt = toDate(existingData.joinedAt);
  const existingSessionStartedAt = toDate(existingData.sessionStartedAt) || existingJoinedAt;
  const existingLeftAt = toDate(existingData.leftAt);
  const existingStatus = existingData.status;

  const isSameKnownPatient =
    isKnownUserId(existingPatientUserId) &&
    isKnownUserId(nextPatientUserId) &&
    existingPatientUserId === nextPatientUserId;

  const minutesSinceJoined = existingJoinedAt
    ? (now.getTime() - existingJoinedAt.getTime()) / (1000 * 60)
    : Number.POSITIVE_INFINITY;

  const shouldReuseStart =
    existingStatus === 'active' &&
    !existingLeftAt &&
    isSameKnownPatient &&
    Number.isFinite(minutesSinceJoined) &&
    minutesSinceJoined <= reconnectWindowMinutes &&
    Boolean(existingJoinedAt) &&
    Boolean(existingSessionStartedAt);

  if (shouldReuseStart) {
    return {
      joinedAt: existingJoinedAt!,
      sessionStartedAt: existingSessionStartedAt!,
      reusedExistingStart: true,
    };
  }

  return {
    joinedAt: now,
    sessionStartedAt: now,
    reusedExistingStart: false,
  };
}

interface DurationInput {
  startedAt: DateLike;
  endedAt?: DateLike;
  maxDurationMinutes?: number;
}

export function calculateDurationMinutes({
  startedAt,
  endedAt = new Date(),
  maxDurationMinutes = DEFAULT_MAX_DURATION_MINUTES,
}: DurationInput): number {
  const start = toDate(startedAt);
  const end = toDate(endedAt);

  if (!start || !end) {
    return 0;
  }

  const rawMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  if (!Number.isFinite(rawMinutes) || rawMinutes < 0) {
    return 0;
  }

  return Math.min(rawMinutes, maxDurationMinutes);
}

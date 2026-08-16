/**
 * Presentation rules for consultation history.
 *
 * The doctor's question is "what happened, with whom, and when" — not "which
 * room document exists". These helpers turn raw history records into the few
 * facts the list actually shows (status, who attended, when it happened) so the
 * view components stay declarative and the rules live in one testable place.
 */

import { isBeyondSummaryRetention, SUMMARY_RETENTION_DAYS } from './retention-policy';

export type ConsultationStatus =
  | 'summarized'
  | 'awaiting-summary'
  | 'summary-expired'
  | 'not-admitted'
  | 'no-show';

export interface ConsultationStatusPresentation {
  status: ConsultationStatus;
  label: string;
  /** Text color and background for the status chip. */
  color: string;
  background: string;
}

const STATUS_PRESENTATION: Record<ConsultationStatus, Omit<ConsultationStatusPresentation, 'status'>> = {
  summarized: { label: 'Summarized', color: '#065f46', background: '#d1fae5' },
  'awaiting-summary': { label: 'Awaiting summary', color: '#92400e', background: '#fef3c7' },
  'summary-expired': { label: `Summary deleted after ${SUMMARY_RETENTION_DAYS} days`, color: '#4b5563', background: '#f3f4f6' },
  // Amber, not grey: a patient who waited and was never let in is an action for
  // the practice, unlike a patient who simply never arrived.
  'not-admitted': { label: 'Patient not admitted', color: '#b45309', background: '#fef3c7' },
  'no-show': { label: 'No patient joined', color: '#4b5563', background: '#f3f4f6' },
};

/**
 * A consultation past the retention window has no summary because the
 * retention job deleted it, not because one is pending — presenting that as
 * "awaiting summary" would invite the doctor to regenerate records the policy
 * deliberately removed.
 */
export function resolveConsultationStatus(
  record: {
    hasGeneratedSummary: boolean;
    category?: string;
    startedAt?: Date | null;
  },
  now: Date = new Date()
): ConsultationStatusPresentation {
  const status: ConsultationStatus = record.category === 'Not Admitted'
    ? 'not-admitted'
    : record.category === 'No-Show'
      ? 'no-show'
      : record.hasGeneratedSummary
        ? 'summarized'
        : isBeyondSummaryRetention(record.startedAt ?? null, now)
          ? 'summary-expired'
          : 'awaiting-summary';

  return { status, ...STATUS_PRESENTATION[status] };
}

/**
 * Who the doctor saw, as they would describe it. Falls back through the
 * identity the system actually captured rather than showing an internal id.
 */
export function resolveAttendeeLabel(record: {
  patientEmail?: string | null;
  category?: string;
  waitingRoomHistory?: { participantEmails: string[]; anonymousParticipantCount: number } | undefined;
}): string {
  if (record.category === 'No-Show') {
    return 'No patient joined';
  }

  if (record.category === 'Not Admitted') {
    return record.waitingRoomHistory?.participantEmails?.[0] || 'Patient left the waiting room';
  }

  if (record.patientEmail) {
    return record.patientEmail;
  }

  const waitingRoomEmail = record.waitingRoomHistory?.participantEmails?.[0];
  if (waitingRoomEmail) {
    return waitingRoomEmail;
  }

  if (record.waitingRoomHistory?.anonymousParticipantCount) {
    return 'Anonymous patient';
  }

  return 'Unidentified patient';
}

export type RiskLevel = 'High' | 'Medium' | 'Low' | string;

/** Risk styling, or null when risk was never assessed and should stay hidden. */
export function resolveRiskPresentation(riskLevel: string | undefined): { color: string; background: string } | null {
  if (riskLevel === 'High') {
    return { color: '#b91c1c', background: '#fee2e2' };
  }
  if (riskLevel === 'Medium') {
    return { color: '#b45309', background: '#fef3c7' };
  }
  if (riskLevel === 'Low') {
    return { color: '#047857', background: '#d1fae5' };
  }
  return null;
}

/**
 * Heading for the day a consultation happened. Groups are per-day rather than
 * per-month so the date is always visible: a month heading would leave every
 * card showing only a time of day, with no way to tell the 3rd from the 27th.
 * Recent days get relative names, which is how a doctor refers to them.
 */
export function resolveDateGroupLabel(date: Date | null, now: Date = new Date()): string {
  if (!date || Number.isNaN(date.getTime()) || date.getTime() <= 0) {
    return 'Undated';
  }

  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const daysApart = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  const fullDate = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });

  if (daysApart === 0) return `Today · ${fullDate}`;
  if (daysApart === 1) return `Yesterday · ${fullDate}`;
  return fullDate;
}

/** Groups records into ordered date buckets, preserving the incoming order. */
export function groupByDateBucket<T>(
  records: T[],
  getDate: (record: T) => Date | null,
  now: Date = new Date()
): Array<{ label: string; records: T[] }> {
  const groups: Array<{ label: string; records: T[] }> = [];

  for (const record of records) {
    const label = resolveDateGroupLabel(getDate(record), now);
    const currentGroup = groups[groups.length - 1];
    if (currentGroup && currentGroup.label === label) {
      currentGroup.records.push(record);
    } else {
      groups.push({ label, records: [record] });
    }
  }

  return groups;
}

export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 'Under a minute';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

/** Time of day only; the date is already carried by the group heading. */
export function formatTimeOfDay(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime()) || date.getTime() <= 0) {
    return 'Unknown time';
  }
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime()) || date.getTime() <= 0) {
    return 'N/A';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Case-insensitive match across the fields a doctor would search by. Returns
 * true for an empty query so callers can pass user input straight through.
 */
export function matchesSearch(
  record: { roomName: string; summary: string; patientEmail?: string | null; category?: string },
  query: string
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [record.roomName, record.summary, record.patientEmail, record.category]
    .filter((field): field is string => typeof field === 'string' && field.length > 0)
    .some((field) => field.toLowerCase().includes(normalizedQuery));
}

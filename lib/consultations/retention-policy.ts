/**
 * Summary retention policy.
 *
 * This is the default policy window, not proof of a deployed deletion. The
 * Cloud Function is explicitly opt-in and its window is configurable; it ages
 * summaries from their creation time, not the consultation's start time.
 * Missing content needs a deletion receipt before a UI can claim it was erased.
 */
export const SUMMARY_RETENTION_DAYS = 30;

const MILLISECONDS_PER_DAY = 86_400_000;

/** Age hint only; never use this as evidence that a retention worker deleted content. */
export function isBeyondSummaryRetention(consultationDate: Date | null, now: Date = new Date()): boolean {
  if (!consultationDate || Number.isNaN(consultationDate.getTime()) || consultationDate.getTime() <= 0) {
    return false;
  }

  return now.getTime() - consultationDate.getTime() > SUMMARY_RETENTION_DAYS * MILLISECONDS_PER_DAY;
}

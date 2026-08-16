/**
 * Summary retention policy.
 *
 * The `autoDeleteSummaries` Cloud Function (functions/index.js) permanently
 * deletes call summaries older than this window, while the consultation
 * sessions themselves are kept. Anything older therefore has no summary by
 * design — the UI reads this to tell "the summary was deleted on purpose"
 * apart from "a summary was never produced", which are very different things
 * to show a doctor.
 *
 * Keep this in step with the retention window in functions/index.js.
 */
export const SUMMARY_RETENTION_DAYS = 30;

const MILLISECONDS_PER_DAY = 86_400_000;

/** True when a consultation is old enough that retention has removed its summary. */
export function isBeyondSummaryRetention(consultationDate: Date | null, now: Date = new Date()): boolean {
  if (!consultationDate || Number.isNaN(consultationDate.getTime()) || consultationDate.getTime() <= 0) {
    return false;
  }

  return now.getTime() - consultationDate.getTime() > SUMMARY_RETENTION_DAYS * MILLISECONDS_PER_DAY;
}

import type { Firestore } from 'firebase-admin/firestore';
import { SUMMARY_RETENTION_DAYS } from './retention-policy';

/**
 * Each summary also deletes its `scheduled-deletions` row: 200 summaries use
 * 400 batch operations, under Firestore's 500-operation limit. Later daily runs
 * resume where this one stopped.
 */
export const MAX_RETENTION_PAGE = 200;

export interface SummaryRetentionPolicy {
  enabled: boolean;
  days: number;
}

export interface SummaryRetentionRun {
  enabled: boolean;
  days: number;
  cutoff: string;
  /** Summaries older than the cutoff before this run (aggregate count, no content). */
  eligibleBefore: number;
  deletedCount: number;
  remainingMayExist: boolean;
}

/**
 * Deployment policy. Destructive deletion is opt-in with
 * RETENTION_ENFORCEMENT_ENABLED=true; SUMMARY_RETENTION_DAYS (1-3650) defaults
 * to 30. Anything malformed falls back to the safe default window.
 */
export function summaryRetentionPolicy(environment: NodeJS.ProcessEnv = process.env): SummaryRetentionPolicy {
  const configuredDays = Number.parseInt(environment.SUMMARY_RETENTION_DAYS || '', 10);
  return {
    enabled: environment.RETENTION_ENFORCEMENT_ENABLED === 'true',
    days: Number.isFinite(configuredDays) && configuredDays >= 1 && configuredDays <= 3650
      ? configuredDays
      : SUMMARY_RETENTION_DAYS,
  };
}

/**
 * Runs one bounded retention pass over `call-summaries`, aged by the summary's
 * `createdAt`. With enforcement off it is a dry run that only counts eligible
 * summaries, so an operator can see the effect before turning deletion on.
 *
 * Every run writes a metadata-only receipt to `retention-runs/{UTC date}`
 * (counts, window, cutoff; never ids, names or clinical text). The receipt is
 * the evidence that deletion ran; a missing summary alone proves nothing.
 * Consultation/encounter records are kept; only the AI summary is removed.
 */
export async function enforceSummaryRetention(
  db: Firestore,
  policy: SummaryRetentionPolicy,
  now: Date = new Date()
): Promise<SummaryRetentionRun> {
  const cutoff = new Date(now.getTime() - policy.days * 86_400_000);
  const expired = db.collection('call-summaries').where('createdAt', '<', cutoff);
  const eligibleBefore = (await expired.count().get()).data().count;

  let deletedCount = 0;
  let remainingMayExist = eligibleBefore > 0;
  if (policy.enabled && eligibleBefore > 0) {
    const page = await expired.limit(MAX_RETENTION_PAGE).get();
    const batch = db.batch();
    for (const document of page.docs) {
      batch.delete(document.ref);
      batch.delete(db.collection('scheduled-deletions').doc(document.id));
    }
    await batch.commit();
    deletedCount = page.size;
    remainingMayExist = eligibleBefore > page.size;
  }

  const run: SummaryRetentionRun = {
    enabled: policy.enabled,
    days: policy.days,
    cutoff: cutoff.toISOString(),
    eligibleBefore,
    deletedCount,
    remainingMayExist,
  };
  await db.collection('retention-runs').doc(now.toISOString().slice(0, 10)).set({ ...run, ranAt: now });
  return run;
}

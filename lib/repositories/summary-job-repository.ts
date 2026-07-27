import { FieldValue, type Firestore } from 'firebase-admin/firestore';

const COLLECTION = 'summaryJobs';
const RETRY_DELAY_MS = 5 * 60 * 1000;

export interface ClaimedSummaryJob {
  id: string;
  consultationSessionId: string | null;
  attempts: number;
}

/**
 * Own the durable AI-summary retry queue. Jobs contain only identifiers and
 * operational state; consultation text remains in its existing collections.
 */
export class SummaryJobRepository {
  constructor(private readonly db: Firestore) {}

  async markProcessing(input: {
    summaryId: string;
    consultationSessionId: string;
    doctorUserId: string;
  }): Promise<void> {
    await this.db.collection(COLLECTION).doc(input.summaryId).set(
      {
        consultationSessionId: input.consultationSessionId,
        doctorUserId: input.doctorUserId,
        status: 'processing',
        attempts: FieldValue.increment(1),
        processingStartedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS),
      },
      { merge: true }
    );
  }

  async markCompleted(summaryId: string, status: 'ready' | 'unavailable'): Promise<void> {
    await this.db.collection(COLLECTION).doc(summaryId).set(
      {
        status,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        nextAttemptAt: FieldValue.delete(),
        lastFailureCode: FieldValue.delete(),
      },
      { merge: true }
    );
  }

  async markFailed(summaryId: string, failureCode: string): Promise<void> {
    await this.db.collection(COLLECTION).doc(summaryId).set(
      {
        status: 'failed',
        lastFailureCode: failureCode,
        failedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS),
      },
      { merge: true }
    );
  }

  async markExhausted(summaryId: string): Promise<void> {
    await this.db.collection(COLLECTION).doc(summaryId).set(
      {
        status: 'failed',
        lastFailureCode: 'retry_exhausted',
        updatedAt: FieldValue.serverTimestamp(),
        nextAttemptAt: FieldValue.delete(),
      },
      { merge: true }
    );
  }

  /**
   * Claim a bounded page of failed or lease-expired work. Each candidate is
   * re-read transactionally so overlapping cron invocations cannot both run it.
   */
  async claimDue(limit = 5): Promise<ClaimedSummaryJob[]> {
    const now = new Date();
    const snapshot = await this.db
      .collection(COLLECTION)
      .where('nextAttemptAt', '<=', now)
      .orderBy('nextAttemptAt', 'asc')
      .limit(limit)
      .get();

    const claimed: ClaimedSummaryJob[] = [];
    for (const candidate of snapshot.docs) {
      const claim = await this.db.runTransaction(async (transaction) => {
        const latest = await transaction.get(candidate.ref);
        if (!latest.exists) return null;

        const data = latest.data() as Record<string, unknown>;
        const nextAttemptAt = data.nextAttemptAt as { toDate?: () => Date } | Date | undefined;
        const nextAttemptDate =
          nextAttemptAt instanceof Date ? nextAttemptAt : nextAttemptAt?.toDate?.();
        if (!nextAttemptDate || nextAttemptDate.getTime() > now.getTime()) {
          return null;
        }

        transaction.update(candidate.ref, {
          status: 'processing',
          claimedAt: FieldValue.serverTimestamp(),
          nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS),
        });
        return {
          id: candidate.id,
          consultationSessionId:
            typeof data.consultationSessionId === 'string'
              ? data.consultationSessionId
              : null,
          attempts: Number(data.attempts || 0),
        };
      });
      if (claim) claimed.push(claim);
    }

    return claimed;
  }
}

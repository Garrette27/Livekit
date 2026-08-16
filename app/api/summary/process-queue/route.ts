import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { SummaryJobRepository } from '@/lib/repositories/summary-job-repository';
import { FirestoreSummaryProjectionService } from '@/lib/services/history-summary';
import { withRequestLogging } from '@/lib/services/shared/request-logging';

export const maxDuration = 60;

function isAuthorizedCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(
    cronSecret &&
      req.headers.get('authorization') === `Bearer ${cronSecret}`
  );
}

/**
 * Retry a bounded page of failed or lease-expired summary jobs. Vercel Cron
 * supplies CRON_SECRET as a bearer token; no browser or application role can
 * invoke this operational worker.
 */
async function handleGET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const db = getFirebaseAdmin();
  if (!db) {
    return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
  }

  const jobRepository = new SummaryJobRepository(db);
  const jobs = await jobRepository.claimDue(5);
  const projection = new FirestoreSummaryProjectionService(db);
  const results: Array<{ summaryId: string; status: 'processed' | 'failed' }> = [];

  for (const job of jobs) {
    if (job.attempts >= 5) {
      await jobRepository.markExhausted(job.id);
      results.push({ summaryId: job.id, status: 'failed' });
      continue;
    }
    const consultationSessionId =
      typeof job.consultationSessionId === 'string'
        ? job.consultationSessionId.trim()
        : '';
    if (!consultationSessionId) {
      await jobRepository.markFailed(job.id, 'missing_session_id');
      results.push({ summaryId: job.id, status: 'failed' });
      continue;
    }

    try {
      await projection.buildSummary({ consultationSessionId, regenerate: true });
      results.push({ summaryId: job.id, status: 'processed' });
    } catch (error) {
      console.error('Summary queue job failed:', {
        summaryId: job.id,
        error: error instanceof Error ? error.message : String(error),
      });
      await jobRepository.markFailed(job.id, 'worker_failed');
      results.push({ summaryId: job.id, status: 'failed' });
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
  });
}

export const GET = withRequestLogging(handleGET);

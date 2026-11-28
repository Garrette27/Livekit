import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { bearerSecretMatches } from '@/lib/services/shared/admin-secret-auth';
import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { enforceSummaryRetention, summaryRetentionPolicy } from '@/lib/consultations/summary-retention';

export const maxDuration = 60;

/**
 * Daily summary-retention worker run by Vercel Cron (Firebase scheduled
 * functions need the Blaze plan, so this is the active path on Spark). Only a
 * request bearing CRON_SECRET may run it. Deletion happens only when
 * RETENTION_ENFORCEMENT_ENABLED=true; otherwise it reports a dry-run count.
 */
async function handleGET(req: NextRequest) {
  if (!bearerSecretMatches(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const db = getFirebaseAdmin();
  if (!db) {
    return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
  }
  const run = await enforceSummaryRetention(db, summaryRetentionPolicy());
  return NextResponse.json({ success: true, ...run }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export const GET = withRequestLogging(handleGET);

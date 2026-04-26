/**
 * One-shot backfill for consultations that completed before deterministic
 * doctor-leave finalization landed. Iterates completed sessions whose summary
 * is missing or remains a fallback/error placeholder, gathers the same context
 * the runtime would have, and invokes the canonical summary generator.
 *
 * Idempotency is enforced inside generateAndStoreConsultationSummary
 * (metadata.aiSummaryGenerated / isEdited), so re-runs are safe.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/backfill-summaries.ts
 *   npx tsx --env-file=.env.local scripts/backfill-summaries.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/backfill-summaries.ts --doctor=<uid>
 *   npx tsx --env-file=.env.local scripts/backfill-summaries.ts --limit=50
 */

import type { Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { generateAndStoreConsultationSummary } from '@/lib/consultations/summary-service';
import { isKnownUserId } from '@/lib/consultations/identity-utils';

interface BackfillFlags {
  dryRun: boolean;
  doctorUserId: string | null;
  limit: number;
}

interface SessionRecord {
  sessionId: string;
  roomName: string;
  doctorUserId: string | null;
  patientUserId: string | null;
  patientEmail: string | null;
  patientName: string;
  durationMinutes: number;
}

function parseFlags(argv: string[]): BackfillFlags {
  const flags: BackfillFlags = { dryRun: false, doctorUserId: null, limit: 1000 };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') flags.dryRun = true;
    else if (arg.startsWith('--doctor=')) flags.doctorUserId = arg.slice('--doctor='.length).trim() || null;
    else if (arg.startsWith('--limit=')) {
      const parsed = Number(arg.slice('--limit='.length));
      if (Number.isFinite(parsed) && parsed > 0) flags.limit = Math.floor(parsed);
    }
  }
  return flags;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asPositiveInt(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

async function summaryNeedsRegeneration(db: Firestore, summaryDocId: string): Promise<boolean> {
  const doc = await db.collection('call-summaries').doc(summaryDocId).get();
  if (!doc.exists) return true;

  const metadata = (doc.data()?.metadata as Record<string, unknown> | undefined) || {};
  if (metadata.isEdited === true) return false;
  if (metadata.aiSummaryGenerated === true) return false;
  return true;
}

async function loadTranscriptLines(db: Firestore, sessionId: string): Promise<string[]> {
  try {
    const snapshot = await db
      .collection('consultationSessions')
      .doc(sessionId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .limit(500)
      .get();

    if (snapshot.empty) return [];

    return snapshot.docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        const text = asString(data.text);
        if (!text) return null;
        const speaker =
          asString(data.senderName) ||
          (asString(data.senderType) === 'doctor' ? 'Doctor' : 'Patient');
        return `${speaker}: ${text}`;
      })
      .filter((line): line is string => Boolean(line));
  } catch (error) {
    console.warn(`  ! Failed to load transcript for ${sessionId}:`, (error as Error).message);
    return [];
  }
}

async function loadConsultationFallback(
  db: Firestore,
  roomName: string
): Promise<Record<string, unknown> | null> {
  if (!roomName) return null;
  const consultationDoc = await db.collection('consultations').doc(roomName).get();
  return consultationDoc.exists ? (consultationDoc.data() as Record<string, unknown>) : null;
}

function resolveSessionRecord(input: {
  sessionId: string;
  sessionData: Record<string, unknown>;
  consultationData: Record<string, unknown> | null;
}): SessionRecord | null {
  const { sessionId, sessionData, consultationData } = input;
  const sessionMetadata = (sessionData.metadata as Record<string, unknown> | undefined) || {};
  const consultationMetadata =
    (consultationData?.metadata as Record<string, unknown> | undefined) || {};

  const roomName = asString(sessionData.roomName) || asString(consultationData?.roomName);
  if (!roomName) return null;

  const doctorUserId =
    asString(sessionData.doctorUserId) ||
    asString(sessionMetadata.createdBy) ||
    asString(consultationData?.createdBy) ||
    asString(consultationMetadata.createdBy);
  if (!doctorUserId) return null;

  const rawPatientUserId =
    asString(sessionData.patientUserId) ||
    asString(sessionMetadata.patientUserId) ||
    asString(consultationData?.patientUserId) ||
    asString(consultationMetadata.patientUserId);
  const patientUserId = isKnownUserId(rawPatientUserId) ? rawPatientUserId : null;

  const patientEmail =
    asString(sessionData.patientEmail) ||
    asString(sessionMetadata.patientEmail) ||
    asString(consultationData?.patientEmail) ||
    asString(consultationMetadata.patientEmail);

  const patientName =
    asString(consultationData?.patientName) ||
    asString(sessionMetadata.patientName) ||
    'Patient';

  const durationMinutes = Math.max(
    asPositiveInt(sessionData.duration),
    asPositiveInt(sessionMetadata.durationMinutes),
    asPositiveInt(sessionMetadata.finalDurationMinutes),
    asPositiveInt(sessionMetadata.doctorDurationMinutes),
    asPositiveInt(consultationData?.duration),
    asPositiveInt(consultationMetadata.durationMinutes)
  );

  return {
    sessionId,
    roomName,
    doctorUserId,
    patientUserId,
    patientEmail,
    patientName,
    durationMinutes,
  };
}

async function processSession(
  db: Firestore,
  input: { record: SessionRecord; dryRun: boolean }
): Promise<'regenerated' | 'skipped_existing' | 'dry_run'> {
  const { record, dryRun } = input;

  if (!(await summaryNeedsRegeneration(db, record.sessionId))) {
    return 'skipped_existing';
  }

  const transcriptLines = await loadTranscriptLines(db, record.sessionId);

  console.log(
    `  -> ${record.sessionId} room=${record.roomName} doctor=${record.doctorUserId} ` +
      `duration=${record.durationMinutes}m transcript=${transcriptLines.length}`
  );

  if (dryRun) return 'dry_run';

  await generateAndStoreConsultationSummary({
    roomName: record.roomName,
    patientName: record.patientName,
    durationMinutes: record.durationMinutes,
    userId: record.doctorUserId as string,
    consultationSessionId: record.sessionId,
    patientUserId: record.patientUserId,
    patientEmail: record.patientEmail,
    transcriptionData: transcriptLines.length > 0 ? transcriptLines : null,
  });

  return 'regenerated';
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv);
  console.log(
    `Backfill starting (dryRun=${flags.dryRun}, doctorFilter=${flags.doctorUserId || 'none'}, limit=${flags.limit})`
  );

  const db = getFirebaseAdmin();
  if (!db) {
    console.error(
      'Firebase Admin not initialized. Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, ' +
        'FIREBASE_PRIVATE_KEY are set (use --env-file=.env.local).'
    );
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY && !flags.dryRun) {
    console.warn(
      'OPENAI_API_KEY is not set. The generator will store fallback summaries ' +
        'instead of AI-generated ones. Pass --dry-run if that is unintended.'
    );
  }

  // Single-field filter avoids requiring a composite index. Doctor scoping is
  // applied client-side below so this script remains usable on any deployment.
  const snapshot = await db
    .collection('consultationSessions')
    .where('status', '==', 'completed')
    .limit(flags.limit)
    .get();
  console.log(`Found ${snapshot.size} completed sessions to inspect.`);

  const counts = {
    regenerated: 0,
    skipped_existing: 0,
    dry_run: 0,
    skipped_unresolvable: 0,
    failed: 0,
  };

  for (const doc of snapshot.docs) {
    const sessionData = doc.data() as Record<string, unknown>;
    const sessionId = asString(sessionData.consultationSessionId) || doc.id;
    const consultationData = await loadConsultationFallback(
      db,
      asString(sessionData.roomName) || ''
    );

    const record = resolveSessionRecord({ sessionId, sessionData, consultationData });
    if (!record) {
      counts.skipped_unresolvable += 1;
      console.log(`  - ${doc.id}: skipped (could not resolve roomName/doctorUserId)`);
      continue;
    }

    if (flags.doctorUserId && record.doctorUserId !== flags.doctorUserId) {
      continue;
    }

    try {
      const outcome = await processSession(db, { record, dryRun: flags.dryRun });
      counts[outcome] += 1;
    } catch (error) {
      counts.failed += 1;
      console.error(`  ! ${record.sessionId}: regeneration failed:`, error);
    }
  }

  console.log('Backfill complete.');
  console.log(JSON.stringify(counts, null, 2));
}

main().catch((error) => {
  console.error('Backfill aborted with unexpected error:', error);
  process.exit(1);
});

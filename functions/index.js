/* eslint-disable @typescript-eslint/no-require-imports */
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const activityLogPipeline = require('./activity-log-pipeline');
const { logInfo, logWarn, logError } = require('./structured-logger');

admin.initializeApp();

const DEFAULT_SUMMARY_RETENTION_DAYS = 30;
const MAX_RETENTION_BATCH_SIZE = 400;

/**
 * Resolve the deployment's explicit summary-retention policy. Destructive
 * cleanup stays disabled until the operator opts in with an environment flag.
 */
function summaryRetentionPolicy() {
  const configuredDays = Number.parseInt(process.env.SUMMARY_RETENTION_DAYS || '', 10);
  return {
    enabled: process.env.RETENTION_ENFORCEMENT_ENABLED === 'true',
    days:
      Number.isFinite(configuredDays) && configuredDays >= 1 && configuredDays <= 3650
        ? configuredDays
        : DEFAULT_SUMMARY_RETENTION_DAYS,
  };
}

/**
 * Delete one bounded page of expired summaries. A bounded batch prevents the
 * daily job from exceeding Firestore's write limit and lets later runs resume.
 */
async function deleteExpiredSummaryPage(db, cutoff) {
  const snapshot = await db
    .collection('call-summaries')
    .where('createdAt', '<', cutoff)
    .limit(MAX_RETENTION_BATCH_SIZE)
    .get();

  if (snapshot.empty) {
    return { deletedCount: 0, remainingMayExist: false };
  }

  const batch = db.batch();
  for (const document of snapshot.docs) {
    batch.delete(document.ref);
    batch.delete(db.collection('scheduled-deletions').doc(document.id));
  }
  await batch.commit();

  return {
    deletedCount: snapshot.size,
    remainingMayExist: snapshot.size === MAX_RETENTION_BATCH_SIZE,
  };
}

/**
 * Enforce the configured call-summary retention period once per day.
 *
 * Set RETENTION_ENFORCEMENT_ENABLED=true only after the thesis team has
 * approved its retention policy; SUMMARY_RETENTION_DAYS defaults to 30.
 */
exports.autoDeleteSummaries = functions.pubsub.schedule('every 24 hours').onRun(async () => {
  const policy = summaryRetentionPolicy();
  if (!policy.enabled) {
    logWarn({
      message: 'Summary retention is configured in dry-run mode.',
      correlation: {
        eventDomain: 'history.retention',
        eventType: 'retention_disabled',
      },
      metadata: { retentionDays: policy.days },
    });
    return { deletedCount: 0, disabled: true };
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - policy.days);
    const cutoff = admin.firestore.Timestamp.fromDate(cutoffDate);
    const result = await deleteExpiredSummaryPage(admin.firestore(), cutoff);

    logInfo({
      message: 'Summary retention job completed.',
      correlation: {
        eventDomain: 'history.retention',
        eventType: 'auto_delete_completed',
      },
      metadata: {
        retentionDays: policy.days,
        cutoff: cutoffDate.toISOString(),
        ...result,
      },
    });
    return result;
  } catch (error) {
    logError({
      message: 'Summary retention job failed.',
      correlation: {
        eventDomain: 'history.retention',
        eventType: 'auto_delete_failed',
      },
      error,
    });
    throw error;
  }
});

// Server-owned Firestore audit triggers. No callable administrative or token
// minting functions are exported from this deployment.
exports.auditConsultationDocuments = activityLogPipeline.auditConsultationDocuments;
exports.auditConsultationSessions = activityLogPipeline.auditConsultationSessions;
exports.auditConsultationSessionEvents = activityLogPipeline.auditConsultationSessionEvents;
exports.auditCallSummaries = activityLogPipeline.auditCallSummaries;
exports.auditInvitations = activityLogPipeline.auditInvitations;
exports.auditWaitingPatients = activityLogPipeline.auditWaitingPatients;
exports.auditUsers = activityLogPipeline.auditUsers;

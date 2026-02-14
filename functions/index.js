/* eslint-disable @typescript-eslint/no-require-imports */
const functions = require('firebase-functions/v1');
const { AccessToken } = require('livekit-server-sdk');
const fetch = require('node-fetch');
const admin = require('firebase-admin');
const activityLogPipeline = require('./activity-log-pipeline');
const { logInfo, logWarn, logError } = require('./structured-logger');

admin.initializeApp();

exports.getJoinToken = functions.https.onRequest((req, res) => {
  const identity = typeof req.body?.identity === 'string' ? req.body.identity.trim() : '';
  const roomName = typeof req.body?.roomName === 'string' ? req.body.roomName.trim() : '';
  const consultationSessionId =
    typeof req.body?.consultationSessionId === 'string'
      ? req.body.consultationSessionId.trim()
      : null;
  const invitationId =
    typeof req.body?.invitationId === 'string' ? req.body.invitationId.trim() : null;

  if (!identity || !roomName) {
    logWarn({
      message: 'Join token request rejected due to invalid payload.',
      correlation: {
        eventDomain: 'rtc.transport',
        eventType: 'join_token_request_invalid',
        consultationSessionId,
        roomName,
        invitationId,
      },
      metadata: {
        hasIdentity: Boolean(identity),
        hasRoomName: Boolean(roomName),
      },
    });

    res.status(400).json({ error: 'identity and roomName are required' });
    return;
  }

  const accessToken = new AccessToken(
    functions.config().livekit.key,
    functions.config().livekit.secret,
    { identity }
  );
  accessToken.addGrant({ room: roomName, roomJoin: true });

  logInfo({
    message: 'Join token issued.',
    correlation: {
      eventDomain: 'rtc.transport',
      eventType: 'join_token_issued',
      consultationSessionId,
      roomName,
      invitationId,
    },
    metadata: {
      identity,
    },
  });

  res.json({ token: accessToken.toJwt() });
});

exports.onRoomEnd = functions.https.onRequest(async (req, res) => {
  const roomName =
    typeof req.body?.room?.name === 'string' ? req.body.room.name.trim() : null;

  try {
    const summary = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${functions.config().openai.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: `Summarize the call in ${roomName}` }],
      }),
    }).then((response) => response.json());

    logInfo({
      message: 'Room end summary generation completed.',
      correlation: {
        eventDomain: 'history.summary',
        eventType: 'room_end_summary_generated',
        roomName,
      },
      metadata: {
        hasSummary: Boolean(summary),
      },
    });

    // TODO: Delete the call record from Firestore.
    res.sendStatus(200);
  } catch (error) {
    logError({
      message: 'Room end summary generation failed.',
      correlation: {
        eventDomain: 'history.summary',
        eventType: 'room_end_summary_failed',
        roomName,
      },
      error,
    });

    res.status(500).json({ error: 'Failed to process room end webhook' });
  }
});

// Cloud Function to automatically delete call summaries after 30 days.
exports.autoDeleteSummaries = functions.pubsub.schedule('every 24 hours').onRun(async () => {
  try {
    const db = admin.firestore();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);

    const snapshot = await db
      .collection('call-summaries')
      .where('createdAt', '<', thirtyDaysAgoTimestamp)
      .get();

    if (snapshot.empty) {
      logInfo({
        message: 'No call summaries eligible for auto deletion.',
        correlation: {
          eventDomain: 'history.retention',
          eventType: 'auto_delete_noop',
        },
      });
      return null;
    }

    const deleteResults = await Promise.all(
      snapshot.docs.map(async (doc) => {
        try {
          await doc.ref.delete();
          await db.collection('scheduled-deletions').doc(doc.id).delete();

          logInfo({
            message: 'Call summary deleted by retention job.',
            correlation: {
              eventDomain: 'history.retention',
              eventType: 'summary_deleted',
            },
            metadata: {
              summaryId: doc.id,
            },
          });

          return { id: doc.id, status: 'deleted' };
        } catch (error) {
          logError({
            message: 'Call summary deletion failed in retention job.',
            correlation: {
              eventDomain: 'history.retention',
              eventType: 'summary_delete_failed',
            },
            metadata: {
              summaryId: doc.id,
            },
            error,
          });

          return { id: doc.id, status: 'error' };
        }
      })
    );

    const deletedCount = deleteResults.filter((result) => result.status === 'deleted').length;
    const errorCount = deleteResults.filter((result) => result.status === 'error').length;

    logInfo({
      message: 'Auto-delete summaries job completed.',
      correlation: {
        eventDomain: 'history.retention',
        eventType: 'auto_delete_completed',
      },
      metadata: {
        deletedCount,
        errorCount,
        totalProcessed: deleteResults.length,
      },
    });

    return {
      deletedCount,
      errorCount,
      totalProcessed: deleteResults.length,
    };
  } catch (error) {
    logError({
      message: 'Auto-delete summaries job failed.',
      correlation: {
        eventDomain: 'history.retention',
        eventType: 'auto_delete_failed',
      },
      error,
    });
    throw error;
  }
});

// Cloud Function to manually delete a summary (for admin use).
exports.manualDeleteSummary = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const summaryId = typeof data?.summaryId === 'string' ? data.summaryId.trim() : '';
    if (!summaryId) {
      throw new functions.https.HttpsError('invalid-argument', 'Summary ID is required');
    }

    const db = admin.firestore();
    await db.collection('call-summaries').doc(summaryId).delete();
    await db.collection('scheduled-deletions').doc(summaryId).delete();

    logInfo({
      message: 'Summary manually deleted.',
      correlation: {
        eventDomain: 'history.retention',
        eventType: 'summary_manual_delete',
      },
      metadata: {
        summaryId,
        actorId: context.auth.uid,
      },
    });

    return {
      success: true,
      message: `Summary ${summaryId} deleted successfully`,
    };
  } catch (error) {
    logError({
      message: 'Manual summary deletion failed.',
      correlation: {
        eventDomain: 'history.retention',
        eventType: 'summary_manual_delete_failed',
      },
      metadata: {
        actorId: context.auth?.uid || null,
      },
      error,
    });
    throw new functions.https.HttpsError('internal', 'Failed to delete summary');
  }
});

// Cloud Function to get deletion statistics.
exports.getDeletionStats = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const db = admin.firestore();

    const summariesSnapshot = await db.collection('call-summaries').get();
    const scheduledSnapshot = await db.collection('scheduled-deletions').get();

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysFromNowTimestamp = admin.firestore.Timestamp.fromDate(sevenDaysFromNow);
    const upcomingDeletionsSnapshot = await db
      .collection('scheduled-deletions')
      .where('scheduledFor', '<=', sevenDaysFromNowTimestamp)
      .get();

    const result = {
      totalSummaries: summariesSnapshot.size,
      scheduledDeletions: scheduledSnapshot.size,
      upcomingDeletions: upcomingDeletionsSnapshot.size,
      lastUpdated: new Date().toISOString(),
    };

    logInfo({
      message: 'Deletion statistics requested.',
      correlation: {
        eventDomain: 'history.retention',
        eventType: 'deletion_stats_requested',
      },
      metadata: {
        actorId: context.auth.uid,
        ...result,
      },
    });

    return result;
  } catch (error) {
    logError({
      message: 'Deletion statistics request failed.',
      correlation: {
        eventDomain: 'history.retention',
        eventType: 'deletion_stats_request_failed',
      },
      metadata: {
        actorId: context.auth?.uid || null,
      },
      error,
    });
    throw new functions.https.HttpsError('internal', 'Failed to get deletion statistics');
  }
});

// Firestore onWrite audit trail + admin activity feed pipeline.
exports.auditConsultationDocuments = activityLogPipeline.auditConsultationDocuments;
exports.auditConsultationSessions = activityLogPipeline.auditConsultationSessions;
exports.auditConsultationSessionEvents = activityLogPipeline.auditConsultationSessionEvents;
exports.auditCallSummaries = activityLogPipeline.auditCallSummaries;
exports.auditInvitations = activityLogPipeline.auditInvitations;
exports.auditWaitingPatients = activityLogPipeline.auditWaitingPatients;
exports.auditUsers = activityLogPipeline.auditUsers;

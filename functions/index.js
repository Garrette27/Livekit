const functions = require('firebase-functions');
const { AccessToken } = require('livekit-server-sdk');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

admin.initializeApp();

exports.getJoinToken = functions.https.onRequest((req, res) => {
  const { identity, roomName } = req.body;

  const at = new AccessToken(
    functions.config().livekit.key,
    functions.config().livekit.secret,
    { identity }
  );

  at.addGrant({ room: roomName, roomJoin: true });
  res.json({ token: at.toJwt() });
});

exports.onRoomEnd = functions.https.onRequest(async (req, res) => {
  const roomName = req.body.room?.name;

  // Call OpenAI to summarize
  const summary = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${functions.config().openai.key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: `Summarize the call in ${roomName}` }]
    })
  }).then(r => r.json());

  console.log("Summary:", summary);

  // TODO: Delete the call record from Firestore
  res.sendStatus(200);
});

// Cloud Function to automatically delete call summaries after 30 days
exports.autoDeleteSummaries = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  try {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    
    // Find summaries that are older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);
    
    // Query for summaries older than 30 days
    const snapshot = await db.collection('call-summaries')
      .where('createdAt', '<', thirtyDaysAgoTimestamp)
      .get();
    
    if (snapshot.empty) {
      console.log('No summaries to delete');
      return null;
    }
    
    // Delete each summary
    const deletePromises = snapshot.docs.map(async (doc) => {
      try {
        await doc.ref.delete();
        console.log(`Deleted summary: ${doc.id}`);
        
        // Also delete from scheduled-deletions collection
        await db.collection('scheduled-deletions').doc(doc.id).delete();
        
        return { id: doc.id, status: 'deleted' };
      } catch (error) {
        console.error(`Error deleting summary ${doc.id}:`, error);
        return { id: doc.id, status: 'error', error: error.message };
      }
    });
    
    const results = await Promise.all(deletePromises);
    const deletedCount = results.filter(r => r.status === 'deleted').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    console.log(`Auto-deletion completed: ${deletedCount} deleted, ${errorCount} errors`);
    
    return {
      deletedCount,
      errorCount,
      totalProcessed: results.length
    };
    
  } catch (error) {
    console.error('Error in autoDeleteSummaries:', error);
    throw error;
  }
});

// Cloud Function to manually delete a summary (for admin use)
exports.manualDeleteSummary = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  try {
    const { summaryId } = data;
    
    if (!summaryId) {
      throw new functions.https.HttpsError('invalid-argument', 'Summary ID is required');
    }
    
    const db = admin.firestore();
    
    // Delete from call-summaries collection
    await db.collection('call-summaries').doc(summaryId).delete();
    
    // Delete from scheduled-deletions collection
    await db.collection('scheduled-deletions').doc(summaryId).delete();
    
    console.log(`Manually deleted summary: ${summaryId} by user: ${context.auth.uid}`);
    
    return {
      success: true,
      message: `Summary ${summaryId} deleted successfully`
    };
    
  } catch (error) {
    console.error('Error in manualDeleteSummary:', error);
    throw new functions.https.HttpsError('internal', 'Failed to delete summary');
  }
});

// Cloud Function to get deletion statistics
exports.getDeletionStats = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  try {
    const db = admin.firestore();
    
    // Get total summaries count
    const summariesSnapshot = await db.collection('call-summaries').get();
    const totalSummaries = summariesSnapshot.size;
    
    // Get scheduled deletions count
    const scheduledSnapshot = await db.collection('scheduled-deletions').get();
    const scheduledDeletions = scheduledSnapshot.size;
    
    // Get summaries that will be deleted in the next 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysFromNowTimestamp = admin.firestore.Timestamp.fromDate(sevenDaysFromNow);
    
    const upcomingDeletionsSnapshot = await db.collection('scheduled-deletions')
      .where('scheduledFor', '<=', sevenDaysFromNowTimestamp)
      .get();
    
    const upcomingDeletions = upcomingDeletionsSnapshot.size;
    
    return {
      totalSummaries,
      scheduledDeletions,
      upcomingDeletions,
      lastUpdated: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error in getDeletionStats:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get deletion statistics');
  }
});

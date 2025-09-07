import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { userId, action } = await req.json();
    console.log(`Cleanup sessions for user: ${userId}, action: ${action}`);

    if (!userId) {
      return NextResponse.json({ 
        error: 'User ID is required' 
      }, { status: 400 });
    }

    const db = getFirebaseAdmin();
    if (!db) {
      console.error('❌ Firebase Admin not initialized');
      return NextResponse.json({ 
        error: 'Firebase Admin not initialized',
        message: 'Please check your Firebase environment variables'
      }, { status: 500 });
    }

    let results = {
      callSummariesDeleted: 0,
      consultationsDeleted: 0,
      callSummariesFixed: 0,
      consultationsFixed: 0,
      errors: [] as string[]
    };

    if (action === 'delete_others') {
      // Delete call-summaries that don't belong to this user
      try {
        const summariesRef = db.collection('call-summaries');
        const summariesSnapshot = await summariesRef.get();
        
        for (const doc of summariesSnapshot.docs) {
          const data = doc.data();
          const summaryUserId = data.createdBy || data.metadata?.createdBy;
          
          if (summaryUserId && summaryUserId !== userId) {
            await doc.ref.delete();
            results.callSummariesDeleted++;
            console.log(`Deleted call-summary: ${doc.id} (belonged to: ${summaryUserId})`);
          }
        }
      } catch (error) {
        results.errors.push(`Error deleting call-summaries: ${error}`);
        console.error('Error deleting call-summaries:', error);
      }

      // Delete consultations that don't belong to this user
      try {
        const consultationsRef = db.collection('consultations');
        const consultationsSnapshot = await consultationsRef.get();
        
        for (const doc of consultationsSnapshot.docs) {
          const data = doc.data();
          const consultationUserId = data.createdBy || data.metadata?.createdBy;
          
          if (consultationUserId && consultationUserId !== userId) {
            await doc.ref.delete();
            results.consultationsDeleted++;
            console.log(`Deleted consultation: ${doc.id} (belonged to: ${consultationUserId})`);
          }
        }
      } catch (error) {
        results.errors.push(`Error deleting consultations: ${error}`);
        console.error('Error deleting consultations:', error);
      }

    } else if (action === 'fix_ownership') {
      // Fix call-summaries that don't have proper user ownership
      try {
        const summariesRef = db.collection('call-summaries');
        const summariesSnapshot = await summariesRef.get();
        
        for (const doc of summariesSnapshot.docs) {
          const data = doc.data();
          const summaryUserId = data.createdBy || data.metadata?.createdBy;
          
          if (!summaryUserId || summaryUserId === 'unknown' || summaryUserId === 'anonymous') {
            // Try to find the room creator
            try {
              const roomRef = db.collection('rooms').doc(doc.id);
              const roomDoc = await roomRef.get();
              
              if (roomDoc.exists) {
                const roomData = roomDoc.data();
                const roomCreator = roomData?.createdBy || roomData?.metadata?.createdBy;
                
                if (roomCreator && roomCreator !== 'unknown' && roomCreator !== 'anonymous') {
                  await doc.ref.update({
                    createdBy: roomCreator,
                    metadata: {
                      ...data.metadata,
                      createdBy: roomCreator,
                      fixedAt: new Date()
                    }
                  });
                  results.callSummariesFixed++;
                  console.log(`Fixed call-summary: ${doc.id} (assigned to: ${roomCreator})`);
                } else {
                  // If we can't find the room creator, delete it
                  await doc.ref.delete();
                  results.callSummariesDeleted++;
                  console.log(`Deleted orphaned call-summary: ${doc.id}`);
                }
              } else {
                // Room doesn't exist, delete the summary
                await doc.ref.delete();
                results.callSummariesDeleted++;
                console.log(`Deleted orphaned call-summary: ${doc.id} (room not found)`);
              }
            } catch (error) {
              results.errors.push(`Error fixing call-summary ${doc.id}: ${error}`);
              console.error(`Error fixing call-summary ${doc.id}:`, error);
            }
          }
        }
      } catch (error) {
        results.errors.push(`Error fixing call-summaries: ${error}`);
        console.error('Error fixing call-summaries:', error);
      }

      // Fix consultations that don't have proper user ownership
      try {
        const consultationsRef = db.collection('consultations');
        const consultationsSnapshot = await consultationsRef.get();
        
        for (const doc of consultationsSnapshot.docs) {
          const data = doc.data();
          const consultationUserId = data.createdBy || data.metadata?.createdBy;
          
          if (!consultationUserId || consultationUserId === 'unknown' || consultationUserId === 'anonymous') {
            // Try to find the room creator
            try {
              const roomRef = db.collection('rooms').doc(doc.id);
              const roomDoc = await roomRef.get();
              
              if (roomDoc.exists) {
                const roomData = roomDoc.data();
                const roomCreator = roomData?.createdBy || roomData?.metadata?.createdBy;
                
                if (roomCreator && roomCreator !== 'unknown' && roomCreator !== 'anonymous') {
                  await doc.ref.update({
                    createdBy: roomCreator,
                    metadata: {
                      ...data.metadata,
                      createdBy: roomCreator,
                      fixedAt: new Date()
                    }
                  });
                  results.consultationsFixed++;
                  console.log(`Fixed consultation: ${doc.id} (assigned to: ${roomCreator})`);
                } else {
                  // If we can't find the room creator, delete it
                  await doc.ref.delete();
                  results.consultationsDeleted++;
                  console.log(`Deleted orphaned consultation: ${doc.id}`);
                }
              } else {
                // Room doesn't exist, delete the consultation
                await doc.ref.delete();
                results.consultationsDeleted++;
                console.log(`Deleted orphaned consultation: ${doc.id} (room not found)`);
              }
            } catch (error) {
              results.errors.push(`Error fixing consultation ${doc.id}: ${error}`);
              console.error(`Error fixing consultation ${doc.id}:`, error);
            }
          }
        }
      } catch (error) {
        results.errors.push(`Error fixing consultations: ${error}`);
        console.error('Error fixing consultations:', error);
      }

    } else if (action === 'delete_all') {
      // Delete ALL sessions (use with caution!)
      try {
        const summariesRef = db.collection('call-summaries');
        const summariesSnapshot = await summariesRef.get();
        
        for (const doc of summariesSnapshot.docs) {
          await doc.ref.delete();
          results.callSummariesDeleted++;
        }
        
        const consultationsRef = db.collection('consultations');
        const consultationsSnapshot = await consultationsRef.get();
        
        for (const doc of consultationsSnapshot.docs) {
          await doc.ref.delete();
          results.consultationsDeleted++;
        }
        
        console.log('Deleted ALL sessions from database');
      } catch (error) {
        results.errors.push(`Error deleting all sessions: ${error}`);
        console.error('Error deleting all sessions:', error);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Cleanup completed successfully`,
      results
    });

  } catch (error) {
    console.error('❌ Cleanup sessions error:', error);
    return NextResponse.json({ 
      error: 'Failed to cleanup sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    console.log(`Cleanup test sessions for user: ${userId}`);

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
      testSummariesDeleted: 0,
      testConsultationsDeleted: 0,
      errors: [] as string[]
    };

    // Delete test call-summaries (those with "test-" prefix in room name)
    try {
      const summariesRef = db.collection('call-summaries');
      const summariesSnapshot = await summariesRef.get();
      
      for (const doc of summariesSnapshot.docs) {
        const data = doc.data();
        const roomName = doc.id;
        const summaryUserId = data.createdBy || data.metadata?.createdBy;
        
        // Only delete test sessions that belong to this user
        if (roomName.startsWith('test-') && summaryUserId === userId) {
          await doc.ref.delete();
          results.testSummariesDeleted++;
          console.log(`Deleted test call-summary: ${roomName} (belonged to: ${summaryUserId})`);
        }
      }
    } catch (error) {
      results.errors.push(`Error deleting test call-summaries: ${error}`);
      console.error('Error deleting test call-summaries:', error);
    }

    // Delete test consultations (those with "test-" prefix in room name)
    try {
      const consultationsRef = db.collection('consultations');
      const consultationsSnapshot = await consultationsRef.get();
      
      for (const doc of consultationsSnapshot.docs) {
        const data = doc.data();
        const roomName = doc.id;
        const consultationUserId = data.createdBy || data.metadata?.createdBy;
        
        // Only delete test sessions that belong to this user
        if (roomName.startsWith('test-') && consultationUserId === userId) {
          await doc.ref.delete();
          results.testConsultationsDeleted++;
          console.log(`Deleted test consultation: ${roomName} (belonged to: ${consultationUserId})`);
        }
      }
    } catch (error) {
      results.errors.push(`Error deleting test consultations: ${error}`);
      console.error('Error deleting test consultations:', error);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Test sessions cleanup completed successfully`,
      results
    });

  } catch (error) {
    console.error('❌ Cleanup test sessions error:', error);
    return NextResponse.json({ 
      error: 'Failed to cleanup test sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

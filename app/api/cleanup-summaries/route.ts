import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    console.log('Cleaning up summaries for user:', userId);

    // Get all summaries
    const summariesRef = db.collection('call-summaries');
    const snapshot = await summariesRef.get();
    
    let cleanedCount = 0;
    let deletedCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const summaryUserId = data.createdBy || data.metadata?.createdBy;
      
      // If summary has no user ID, delete it (legacy data)
      if (!summaryUserId) {
        await doc.ref.delete();
        deletedCount++;
        console.log('Deleted legacy summary:', doc.id);
      }
      // If summary has a user ID but it's not the current user, skip it
      else if (summaryUserId !== userId) {
        console.log('Skipping summary for different user:', doc.id, 'User:', summaryUserId);
      }
      else {
        cleanedCount++;
        console.log('Keeping summary for current user:', doc.id);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Cleanup completed',
      cleanedCount,
      deletedCount,
      totalProcessed: snapshot.docs.length
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ 
      error: 'Cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

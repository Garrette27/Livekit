import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const summaryId = searchParams.get('id');

    if (!summaryId) {
      return NextResponse.json({ error: 'Summary ID is required' }, { status: 400 });
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    // Delete from call-summaries collection
    await db.collection('call-summaries').doc(summaryId).delete();
    
    // Delete from scheduled-deletions collection
    await db.collection('scheduled-deletions').doc(summaryId).delete();

    console.log(`Manually deleted summary: ${summaryId}`);

    return NextResponse.json({ 
      success: true, 
      message: `Summary ${summaryId} deleted successfully` 
    });

  } catch (error) {
    console.error('Error deleting summary:', error);
    return NextResponse.json({ 
      error: 'Failed to delete summary' 
    }, { status: 500 });
  }
}


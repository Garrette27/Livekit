import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin, getFirebaseAdminAuth } from '../../../../lib/firebase-admin';

export async function DELETE(req: NextRequest) {
  try {
    // Get Firebase Admin Auth to verify the token
    const auth = getFirebaseAdminAuth();
    if (!auth) {
      return NextResponse.json({ 
        error: 'Firebase Admin not initialized' 
      }, { status: 500 });
    }

    // Get authorization token from headers
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'Authorization token required' 
      }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the Firebase ID token
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      console.error('Token verification error:', error);
      return NextResponse.json({ 
        error: 'Invalid or expired token' 
      }, { status: 401 });
    }

    const userId = decodedToken.uid;

    const { searchParams } = new URL(req.url);
    const summaryId = searchParams.get('id');

    if (!summaryId) {
      return NextResponse.json({ error: 'Summary ID is required' }, { status: 400 });
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    // Get the existing summary to verify ownership
    const summaryRef = db.collection('call-summaries').doc(summaryId);
    const summaryDoc = await summaryRef.get();

    if (!summaryDoc.exists) {
      return NextResponse.json({ 
        error: 'Summary not found' 
      }, { status: 404 });
    }

    const existingSummary = summaryDoc.data();
    
    // Verify that the user is either the creator OR the patient
    const createdBy = existingSummary?.createdBy || existingSummary?.metadata?.createdBy;
    const patientUserId = existingSummary?.patientUserId || existingSummary?.metadata?.patientUserId;
    
    const isCreator = createdBy === userId;
    const isPatient = patientUserId === userId;
    
    if (!isCreator && !isPatient) {
      return NextResponse.json({ 
        error: 'Unauthorized: You can only delete your own consultations' 
      }, { status: 403 });
    }

    // Delete from call-summaries collection
    await db.collection('call-summaries').doc(summaryId).delete();
    
    // Delete from consultations collection (same roomName as summaryId)
    try {
      await db.collection('consultations').doc(summaryId).delete();
    } catch (error) {
      // Consultation might not exist, that's okay
      console.log(`Consultation ${summaryId} not found or already deleted`);
    }
    
    // Delete from scheduled-deletions collection
    try {
      await db.collection('scheduled-deletions').doc(summaryId).delete();
    } catch (error) {
      // Scheduled deletion might not exist, that's okay
      console.log(`Scheduled deletion ${summaryId} not found or already deleted`);
    }

    console.log(`Manually deleted summary: ${summaryId} by user: ${userId} (${isCreator ? 'creator' : 'patient'})`);

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


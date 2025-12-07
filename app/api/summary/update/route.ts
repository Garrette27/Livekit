import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin, getFirebaseAdminAuth } from '../../../../lib/firebase-admin';

export async function PUT(req: NextRequest) {
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

    // Get request body
    const body = await req.json();
    const { summaryId, summary, keyPoints, recommendations, followUpActions, riskLevel, category } = body;

    if (!summaryId) {
      return NextResponse.json({ 
        error: 'Summary ID is required' 
      }, { status: 400 });
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json({ 
        error: 'Database not initialized' 
      }, { status: 500 });
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
    
    // Verify that the user is the creator of this summary
    const createdBy = existingSummary?.createdBy || existingSummary?.metadata?.createdBy;
    if (createdBy !== userId) {
      return NextResponse.json({ 
        error: 'Unauthorized: You can only edit summaries you created' 
      }, { status: 403 });
    }

    // Prepare update data - only update fields that are provided
    const updateData: any = {
      lastEditedAt: new Date(),
      lastEditedBy: userId
    };

    if (summary !== undefined) updateData.summary = summary;
    if (keyPoints !== undefined) updateData.keyPoints = keyPoints;
    if (recommendations !== undefined) updateData.recommendations = recommendations;
    if (followUpActions !== undefined) updateData.followUpActions = followUpActions;
    if (riskLevel !== undefined) updateData.riskLevel = riskLevel;
    if (category !== undefined) updateData.category = category;

    // Update metadata to track edit history
    const existingMetadata = existingSummary?.metadata || {};
    const editHistory = existingMetadata.editHistory || [];
    
    // Track which fields were actually changed (excluding metadata and timestamp fields)
    const changedFields = Object.keys(updateData).filter(
      key => key !== 'lastEditedAt' && key !== 'lastEditedBy' && key !== 'metadata'
    );
    
    if (changedFields.length > 0) {
      editHistory.push({
        editedAt: new Date(),
        editedBy: userId,
        changes: changedFields
      });
    }

    updateData.metadata = {
      ...existingMetadata,
      editHistory,
      lastEditedAt: new Date(),
      lastEditedBy: userId,
      isEdited: true
    };

    // Update the summary
    await summaryRef.update(updateData);

    console.log(`✅ Summary ${summaryId} updated by user ${userId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Summary updated successfully',
      summaryId
    });

  } catch (error) {
    console.error('Error updating summary:', error);
    return NextResponse.json({ 
      error: 'Failed to update summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


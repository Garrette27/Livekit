import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';

/**
 * Migration endpoint to fix waiting patient documents with incorrect doctorUserId
 * 
 * This endpoint:
 * 1. Finds all waiting patient documents
 * 2. For each document, looks up the invitation's createdBy field
 * 3. Updates the waiting patient's doctorUserId to match the invitation's createdBy
 * 
 * Usage: POST /api/migrate/fix-waiting-patients
 * 
 * Optional query params:
 * - dryRun=true: Only show what would be updated without actually updating
 * - limit=N: Limit the number of documents to process (for testing)
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dryRun = searchParams.get('dryRun') === 'true';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    console.log('Starting migration to fix waiting patient doctorUserId values...');
    if (dryRun) {
      console.log('⚠️ DRY RUN MODE - No changes will be made');
    }

    // Get all waiting patient documents
    const waitingPatientsSnapshot = await db.collection('waitingPatients').get();
    
    const results = {
      total: waitingPatientsSnapshot.size,
      processed: 0,
      fixed: 0,
      skipped: 0,
      errors: [] as string[],
      details: [] as Array<{
        waitingPatientId: string;
        oldDoctorUserId: string;
        newDoctorUserId: string;
        invitationId: string;
        status: 'fixed' | 'skipped' | 'error';
        reason?: string;
      }>
    };

    let processedCount = 0;

    for (const doc of waitingPatientsSnapshot.docs) {
      // Apply limit if specified
      if (limit && processedCount >= limit) {
        break;
      }

      const waitingPatient = doc.data();
      const waitingPatientId = doc.id;
      results.processed++;

      try {
        // Skip if doctorUserId is already valid (not 'system' and not empty)
        if (waitingPatient.doctorUserId && 
            waitingPatient.doctorUserId !== 'system' && 
            waitingPatient.doctorUserId.trim() !== '') {
          results.skipped++;
          results.details.push({
            waitingPatientId,
            oldDoctorUserId: waitingPatient.doctorUserId,
            newDoctorUserId: waitingPatient.doctorUserId,
            invitationId: waitingPatient.invitationId || 'unknown',
            status: 'skipped',
            reason: 'doctorUserId already valid'
          });
          continue;
        }

        // Get the invitation to find the correct createdBy
        if (!waitingPatient.invitationId) {
          results.errors.push(`Waiting patient ${waitingPatientId} has no invitationId`);
          results.details.push({
            waitingPatientId,
            oldDoctorUserId: waitingPatient.doctorUserId || 'missing',
            newDoctorUserId: 'unknown',
            invitationId: 'missing',
            status: 'error',
            reason: 'No invitationId found'
          });
          continue;
        }

        const invitationDoc = await db.collection('invitations').doc(waitingPatient.invitationId).get();
        
        if (!invitationDoc.exists) {
          results.errors.push(`Invitation ${waitingPatient.invitationId} not found for waiting patient ${waitingPatientId}`);
          results.details.push({
            waitingPatientId,
            oldDoctorUserId: waitingPatient.doctorUserId || 'missing',
            newDoctorUserId: 'unknown',
            invitationId: waitingPatient.invitationId,
            status: 'error',
            reason: 'Invitation not found'
          });
          continue;
        }

        const invitation = invitationDoc.data();
        const correctDoctorUserId = invitation?.createdBy;

        if (!correctDoctorUserId || correctDoctorUserId === 'system') {
          results.errors.push(`Invitation ${waitingPatient.invitationId} has invalid createdBy: ${correctDoctorUserId}`);
          results.details.push({
            waitingPatientId,
            oldDoctorUserId: waitingPatient.doctorUserId || 'missing',
            newDoctorUserId: correctDoctorUserId || 'system',
            invitationId: waitingPatient.invitationId,
            status: 'error',
            reason: 'Invitation createdBy is invalid'
          });
          continue;
        }

        // Update the waiting patient document
        if (!dryRun) {
          await db.collection('waitingPatients').doc(waitingPatientId).update({
            doctorUserId: correctDoctorUserId
          });
        }

        results.fixed++;
        results.details.push({
          waitingPatientId,
          oldDoctorUserId: waitingPatient.doctorUserId || 'missing',
          newDoctorUserId: correctDoctorUserId,
          invitationId: waitingPatient.invitationId,
          status: 'fixed',
          reason: dryRun ? 'Would be fixed' : 'Fixed successfully'
        });

        console.log(`${dryRun ? '[DRY RUN] Would fix' : 'Fixed'} waiting patient ${waitingPatientId}:`, {
          old: waitingPatient.doctorUserId || 'missing',
          new: correctDoctorUserId
        });

      } catch (error: any) {
        results.errors.push(`Error processing ${waitingPatientId}: ${error.message}`);
        results.details.push({
          waitingPatientId,
          oldDoctorUserId: waitingPatient.doctorUserId || 'missing',
          newDoctorUserId: 'unknown',
          invitationId: waitingPatient.invitationId || 'unknown',
          status: 'error',
          reason: error.message
        });
      }

      processedCount++;
    }

    const response = {
      success: true,
      dryRun,
      summary: {
        total: results.total,
        processed: results.processed,
        fixed: results.fixed,
        skipped: results.skipped,
        errors: results.errors.length
      },
      details: results.details,
      ...(results.errors.length > 0 && { errors: results.errors })
    };

    console.log('Migration completed:', response.summary);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Error during migration:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Migration failed',
        message: error.message 
      },
      { status: 500 }
    );
  }
}


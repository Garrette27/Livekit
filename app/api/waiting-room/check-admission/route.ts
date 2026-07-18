import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { FirestoreInvitationAccessCore, toInvitationAccessError } from '@/lib/services/invitation-access';

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    const invitationId = typeof body.invitationId === 'string' ? body.invitationId.trim() : undefined;
    const waitingPatientId = typeof body.waitingPatientId === 'string' ? body.waitingPatientId.trim() : undefined;
    const patientEmail = typeof body.patientEmail === 'string' ? body.patientEmail.trim() : undefined;

    if (!invitationId && !waitingPatientId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: invitationId or waitingPatientId' },
        { status: 400 }
      );
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    const invitationAccess = new FirestoreInvitationAccessCore(db);
    const admissionResult = await invitationAccess.checkAdmission({
      invitationId,
      waitingPatientId,
      patientEmail,
    });

    return NextResponse.json(admissionResult);
  } catch (error) {
    const mappedError = toInvitationAccessError(error);
    if (mappedError.status !== 500) {
      return NextResponse.json(
        { success: false, error: mappedError.message },
        { status: mappedError.status }
      );
    }

    console.error('Error checking admission status:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);

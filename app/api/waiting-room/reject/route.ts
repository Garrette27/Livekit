import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { FirestoreInvitationAccessCore, toInvitationAccessError } from '@/lib/services/invitation-access';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const waitingPatientId =
      typeof body.waitingPatientId === 'string' ? body.waitingPatientId.trim() : '';
    const doctorUserId = typeof body.doctorUserId === 'string' ? body.doctorUserId.trim() : undefined;

    if (!waitingPatientId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: waitingPatientId' },
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
    const rejectionResult = await invitationAccess.rejectWaitingEntry({
      waitingPatientId,
      doctorUserId,
    });

    return NextResponse.json({
      success: true,
      message: 'Patient rejected',
      status: rejectionResult.status,
      waitingPatientId: rejectionResult.waitingPatientId,
    });
  } catch (error) {
    const mappedError = toInvitationAccessError(error);
    if (mappedError.status !== 500) {
      return NextResponse.json(
        { success: false, error: mappedError.message },
        { status: mappedError.status }
      );
    }

    console.error('Error rejecting patient:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

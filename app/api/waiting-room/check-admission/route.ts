import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { FirestoreInvitationAccessCore, toInvitationAccessError } from '@/lib/services/invitation-access';
import { authorizeWaitingRoomRequest } from '@/lib/services/shared/waiting-room-auth';

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    const invitationId = typeof body.invitationId === 'string' ? body.invitationId.trim() : undefined;
    const waitingPatientId = typeof body.waitingPatientId === 'string' ? body.waitingPatientId.trim() : undefined;
    const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : undefined;

    const authorization = authorizeWaitingRoomRequest({
      accessToken,
      invitationId,
      waitingPatientId,
    });
    if (!authorization.credential) {
      return NextResponse.json(
        { success: false, error: authorization.error },
        { status: authorization.status }
      );
    }

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
    const admissionResult = await invitationAccess.checkAdmission({
      invitationId,
      waitingPatientId,
      credentialRoomName: authorization.credential.roomName,
      credentialVisitId: authorization.credential.visitId,
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

    // Unmapped failures (including database quota) go to the shared wrapper,
    // which logs once and returns 500, or 503 + Retry-After for quota.
    throw error;
  }
}

export const POST = withRequestLogging(handlePOST);

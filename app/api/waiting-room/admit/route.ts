import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { FirestoreInvitationAccessCore, toInvitationAccessError } from '@/lib/services/invitation-access';
import { AdmitPatientRequest, AdmitPatientResponse } from '../../../../lib/types';
import { authorizeBearerRequest } from '@/lib/services/shared/request-auth';
import { serviceResultToResponse } from '@/lib/services/shared/http';

async function handlePOST(req: NextRequest) {
  try {
    const auth = await authorizeBearerRequest(req, 'waiting-room:manage');
    if (!auth.ok) {
      return serviceResultToResponse(auth);
    }

    const body: AdmitPatientRequest = await req.json();
    const { waitingPatientId, roomName } = body;
    const doctorUserId = auth.data.userId;

    if (!waitingPatientId || !roomName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: waitingPatientId and roomName are required' },
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
    const admissionResult = await invitationAccess.admitWaitingEntry({
      waitingPatientId,
      roomName,
      doctorUserId,
    });

    const response: AdmitPatientResponse = {
      success: true,
      liveKitToken: admissionResult.liveKitToken,
      roomName: admissionResult.roomName,
    };

    console.log('Patient admitted to consultation room:', {
      waitingPatientId,
      roomName: admissionResult.roomName,
    });

    return NextResponse.json(response);

  } catch (error) {
    const mappedError = toInvitationAccessError(error);
    if (mappedError.status !== 500) {
      return NextResponse.json(
        { success: false, error: mappedError.message },
        { status: mappedError.status }
      );
    }

    console.error('Error admitting patient:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);

import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { FirestoreInvitationAccessCore, toInvitationAccessError } from '@/lib/services/invitation-access';
import { authorizeWaitingRoomRequest } from '@/lib/services/shared/waiting-room-auth';

async function parseRequestBody(req: NextRequest): Promise<Record<string, unknown>> {
  const rawBody = await req.text();
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    const params = new URLSearchParams(rawBody);
    return {
      waitingPatientId: params.get('waitingPatientId') || undefined,
      accessToken: params.get('accessToken') || undefined,
    };
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const body = await parseRequestBody(req);
    const waitingPatientId = typeof body.waitingPatientId === 'string' ? body.waitingPatientId.trim() : '';
    const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : undefined;

    if (!waitingPatientId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: waitingPatientId' },
        { status: 400 }
      );
    }

    const authorization = authorizeWaitingRoomRequest({
      accessToken,
      waitingPatientId,
    });
    if (!authorization.credential) {
      return NextResponse.json(
        { success: false, error: authorization.error },
        { status: authorization.status }
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
    const result = await invitationAccess.markWaitingEntryLeft({ waitingPatientId });

    return NextResponse.json({
      success: true,
      waitingPatientId: result.waitingPatientId,
      status: result.status,
    });
  } catch (error) {
    const mappedError = toInvitationAccessError(error);
    if (mappedError.status !== 500) {
      return NextResponse.json(
        { success: false, error: mappedError.message },
        { status: mappedError.status }
      );
    }

    console.error('Error marking waiting patient left:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);

import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { FirestoreInvitationAccessCore, toInvitationAccessError } from '@/lib/services/invitation-access';

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
    };
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const body = await parseRequestBody(req);
    const waitingPatientId = typeof body.waitingPatientId === 'string' ? body.waitingPatientId.trim() : '';

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

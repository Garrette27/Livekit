import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { FirestoreInvitationAccessCore, toInvitationAccessError } from '@/lib/services/invitation-access';
import type { WaitingPatient } from '@/lib/types';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

function parseStatuses(rawStatuses: string | null): Array<WaitingPatient['status']> {
  const requestedStatuses = (rawStatuses || 'waiting')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is WaitingPatient['status'] =>
      value === 'waiting' || value === 'admitted' || value === 'left' || value === 'rejected'
    );

  return requestedStatuses.length > 0 ? requestedStatuses : ['waiting'];
}

function parseActiveOnly(rawActiveOnly: string | null): boolean {
  if (!rawActiveOnly) {
    return true;
  }

  return rawActiveOnly !== 'false';
}

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomName = searchParams.get('roomName') || undefined;
    const invitationId = searchParams.get('invitationId') || undefined;
    const doctorUserId = searchParams.get('doctorUserId') || undefined;
    const statuses = parseStatuses(searchParams.get('statuses'));
    const activeOnly = parseActiveOnly(searchParams.get('activeOnly'));

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    const invitationAccess = new FirestoreInvitationAccessCore(db);
    const waitingPatients = await invitationAccess.listWaitingEntries({
      roomName,
      invitationId,
      doctorUserId,
      statuses,
      activeOnly,
    });

    return NextResponse.json({
      success: true,
      waitingPatients,
      count: waitingPatients.length,
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const mappedError = toInvitationAccessError(error);
    if (mappedError.status !== 500) {
      return NextResponse.json(
        { success: false, error: mappedError.message },
        { status: mappedError.status, headers: NO_STORE_HEADERS }
      );
    }

    console.error('Error fetching waiting patients:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export const GET = withRequestLogging(handleGET);

import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { authorizeBearerRequest } from '@/lib/services/shared/request-auth';
import { serviceResultToResponse, unexpectedErrorResponse } from '@/lib/services/shared/http';
import { revokeInvitation } from '@/lib/invitations/revoke-invitation';

// Revocation can finalize the consultation and run AI summarization; give it
// more than the 10s default.
export const maxDuration = 60;

async function handlePOST(req: NextRequest) {
  try {
    const auth = await authorizeBearerRequest(req, 'invitation:manage');
    if (!auth.ok) {
      return serviceResultToResponse(auth);
    }

    const body = await req.json();
    const invitationId =
      typeof body.invitationId === 'string' ? body.invitationId.trim() : '';

    if (!invitationId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: invitationId' },
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

    const result = await revokeInvitation(db, invitationId, auth.data.userId);
    if (!result.ok) return serviceResultToResponse(result);
    return NextResponse.json({ success: true, ...result.data });
  } catch (error) {
    // Internal Firestore/finalization text stays in server logs, never the response.
    console.error('Error revoking invitation:', error);
    return unexpectedErrorResponse(error);
  }
}

export const POST = withRequestLogging(handlePOST);

import { NextRequest, NextResponse } from 'next/server';
import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { authorizeBearerRequest } from '@/lib/services/shared/request-auth';
import { serviceResultToResponse, unexpectedErrorResponse } from '@/lib/services/shared/http';

const MIN_WAITING_LIMIT = 1;
const MAX_WAITING_LIMIT = 100;

/**
 * Changes the waiting limit of the caller's own active invitation.
 * Raising it lets more visitors wait immediately; lowering it never removes
 * anyone already waiting — it only refuses new arrivals until the queue is
 * below the new limit. The limit is read inside the reservation transaction,
 * so the change applies to the very next arrival.
 */
async function handlePOST(req: NextRequest) {
  try {
    const auth = await authorizeBearerRequest(req, 'invitation:manage');
    if (!auth.ok) return serviceResultToResponse(auth);

    const body = await req.json().catch(() => ({}));
    const invitationId = typeof body.invitationId === 'string' ? body.invitationId.trim() : '';
    const requested = Number(body.maxPatients);
    if (!invitationId || !Number.isInteger(requested)) {
      return NextResponse.json({ success: false, error: 'Provide invitationId and a whole-number maxPatients.' }, { status: 400 });
    }
    const maxPatients = Math.min(MAX_WAITING_LIMIT, Math.max(MIN_WAITING_LIMIT, requested));

    const db = getFirebaseAdmin();
    if (!db) return NextResponse.json({ success: false, error: 'Database not available' }, { status: 503 });

    const ref = db.collection('invitations').doc(invitationId);
    const outcome = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      if (!doc.exists) return { status: 404, error: 'Invitation not found' };
      const invitation = doc.data() as { createdBy?: string; status?: string; waitingRoomEnabled?: boolean; expiresAt?: { toMillis?: () => number } };
      if (invitation.createdBy !== auth.data.userId) return { status: 403, error: 'You can only change your own invitations' };
      const expiresMs = invitation.expiresAt?.toMillis?.() ?? 0;
      if ((invitation.status && invitation.status !== 'active') || expiresMs <= Date.now()) {
        return { status: 409, error: 'This invitation is no longer active' };
      }
      if (invitation.waitingRoomEnabled !== true) return { status: 409, error: 'This invitation has no waiting room' };
      transaction.update(ref, { maxPatients, 'audit.limitChangedAt': new Date() });
      return { status: 200 };
    });
    if (outcome.status !== 200) {
      return NextResponse.json({ success: false, error: outcome.error }, { status: outcome.status });
    }
    return NextResponse.json({ success: true, maxPatients });
  } catch (error) {
    return unexpectedErrorResponse(error);
  }
}

export const POST = withRequestLogging(handlePOST);

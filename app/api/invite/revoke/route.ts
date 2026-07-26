import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { finalizeConsultationForRoom } from '../../../../lib/services/consultation-finalization';
import { FirestoreInvitationAccessCore } from '@/lib/services/invitation-access';
import { InvitationRepository } from '../../../../lib/repositories/invitation-repository';
import { authorizeBearerRequest } from '@/lib/services/shared/request-auth';
import { serviceResultToResponse } from '@/lib/services/shared/http';

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

    const invitationRepo = new InvitationRepository(db);
    const invitationDoc = await invitationRepo.getById(invitationId);
    if (!invitationDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Invitation not found' },
        { status: 404 }
      );
    }

    const invitation = invitationDoc.data() as {
      roomName?: string;
      status?: string;
      createdBy?: string;
    };
    if (invitation.createdBy !== auth.data.userId) {
      return NextResponse.json(
        { success: false, error: 'You can only revoke invitations created by your account' },
        { status: 403 }
      );
    }

    const revokedAt = new Date();

    if (invitation.status !== 'revoked') {
      await invitationRepo.mergeFields(invitationId, {
        status: 'revoked',
        revokedAt,
      });
    }

    const invitationAccess = new FirestoreInvitationAccessCore(db);
    const activeWaitingEntries = await invitationAccess.listWaitingEntries({
      invitationId,
      statuses: ['waiting', 'admitted'],
      activeOnly: false,
    });

    await Promise.all(
      activeWaitingEntries.map((waitingEntry) =>
        invitationAccess.rejectWaitingEntry({
          waitingPatientId: waitingEntry.id,
          doctorUserId: invitation.createdBy,
        })
      )
    );

    let finalizationResult: { consultationSessionId: string; finalDurationMinutes: number } | null = null;
    if (invitation.roomName) {
      finalizationResult = await finalizeConsultationForRoom(db, {
        roomName: invitation.roomName,
        finalizedAt: revokedAt,
        reason: 'invitation_revoked',
        regenerateSummary: true,
      });

      if (finalizationResult) {
        await invitationRepo.mergeFields(invitationId, {
          metadata: {
            finalization: {
              at: revokedAt.toISOString(),
              reason: 'invitation_revoked',
              consultationSessionId: finalizationResult.consultationSessionId,
              finalDurationMinutes: finalizationResult.finalDurationMinutes,
              removedParticipantsCount: activeWaitingEntries.length,
            },
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      invitationId,
      revokedAt: revokedAt.toISOString(),
      removedParticipantsCount: activeWaitingEntries.length,
      finalization: finalizationResult,
    });
  } catch (error) {
    console.error('Error revoking invitation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to revoke invitation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);

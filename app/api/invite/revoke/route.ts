import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { finalizeConsultationForRoom } from '../../../../lib/consultations/session-finalization';

export async function POST(req: NextRequest) {
  try {
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

    const invitationRef = db.collection('invitations').doc(invitationId);
    const invitationDoc = await invitationRef.get();
    if (!invitationDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Invitation not found' },
        { status: 404 }
      );
    }

    const invitation = invitationDoc.data() as { roomName?: string; status?: string };
    const revokedAt = new Date();

    if (invitation.status !== 'revoked') {
      await invitationRef.set(
        {
          status: 'revoked',
          revokedAt,
        },
        { merge: true }
      );
    }

    let finalizationResult: { consultationSessionId: string; finalDurationMinutes: number } | null = null;
    if (invitation.roomName) {
      finalizationResult = await finalizeConsultationForRoom(db, {
        roomName: invitation.roomName,
        finalizedAt: revokedAt,
        reason: 'invitation_revoked',
        regenerateSummary: true,
      });

      if (finalizationResult) {
        await invitationRef.set(
          {
            metadata: {
              finalization: {
                at: revokedAt.toISOString(),
                reason: 'invitation_revoked',
                consultationSessionId: finalizationResult.consultationSessionId,
                finalDurationMinutes: finalizationResult.finalDurationMinutes,
              },
            },
          },
          { merge: true }
        );
      }
    }

    return NextResponse.json({
      success: true,
      invitationId,
      revokedAt: revokedAt.toISOString(),
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

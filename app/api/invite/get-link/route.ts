import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { signInvitationToken } from '../../../../lib/invitations/token-utils';
import { buildInviteUrl, toDate } from '../../../../lib/invitations/utils';
import { InvitationToken } from '../../../../lib/types';
import { finalizeConsultationForRoom } from '../../../../lib/services/consultation-finalization';
import { InvitationRepository } from '../../../../lib/repositories/invitation-repository';

function isExpiredInvitation(invitation: any): boolean {
  const expiresAtDate = invitation?.expiresAt
    ? toDate(invitation.expiresAt, new Date(0))
    : new Date('2099-12-31');

  return expiresAtDate.getTime() > 0 && new Date() > expiresAtDate;
}

function pickLatestUsableInvitation(docs: any[]) {
  const usableInvitations = docs
    .map((doc) => ({ doc, data: doc.data?.() }))
    .filter(({ data }) => (data?.status || 'active') === 'active' && !isExpiredInvitation(data))
    .sort((a, b) => {
      const aDate = toDate(a.data?.createdAt, new Date(0)).getTime();
      const bDate = toDate(b.data?.createdAt, new Date(0)).getTime();
      return bDate - aDate;
    });

  return usableInvitations[0]?.doc || null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomName = searchParams.get('roomName');
    const invitationId = searchParams.get('invitationId');

    if (!roomName && !invitationId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: roomName or invitationId' },
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
    let invitationDoc;

    if (invitationId) {
      invitationDoc = await invitationRepo.getById(invitationId);
    } else {
      // Find the most recent usable invitation for this room.
      const candidateDocs = await invitationRepo.findActiveByRoom(roomName!, 20);
      if (candidateDocs.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No active invitation found for this room' },
          { status: 404 }
        );
      }

      invitationDoc = pickLatestUsableInvitation(candidateDocs);
      if (!invitationDoc) {
        return NextResponse.json(
          { success: false, error: 'No active non-expired invitation found for this room' },
          { status: 404 }
        );
      }
    }

    if (!invitationDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Invitation not found' },
        { status: 404 }
      );
    }

    const invitation = invitationDoc.data();
    if (!invitation) {
      return NextResponse.json(
        { success: false, error: 'Invitation data not found' },
        { status: 404 }
      );
    }

    // Check invitation status first
    if (invitation.status !== 'active') {
      console.error('Invitation not active:', {
        invitationId: invitationDoc.id,
        roomName: invitation.roomName,
        status: invitation.status
      });
      return NextResponse.json(
        { 
          success: false, 
          error: `Invitation is not active. Current status: ${invitation.status}`,
          details: {
            status: invitation.status
          }
        },
        { status: 403 }
      );
    }

    // Check if invitation is expired - handle Firestore Timestamp properly
    const expiresAtDate = invitation.expiresAt
      ? toDate(invitation.expiresAt, new Date(0))
      : new Date('2099-12-31');

    const now = new Date();
    const isExpired = expiresAtDate.getTime() > 0 && now > expiresAtDate;

    if (isExpired) {
      if (invitation.status === 'active') {
        try {
          await invitationRepo.mergeFields(invitationDoc.id, {
            status: 'expired',
            expiredAt: expiresAtDate,
          });
          await finalizeConsultationForRoom(db, {
            roomName: invitation.roomName,
            finalizedAt: expiresAtDate,
            reason: 'invitation_expired',
            regenerateSummary: true,
          });
        } catch (expirationFinalizeError) {
          console.error('Failed to finalize consultation for expired invitation:', expirationFinalizeError);
        }
      }

      console.error('Invitation expired:', {
        invitationId: invitationDoc.id,
        roomName: invitation.roomName,
        expiresAt: expiresAtDate.toISOString(),
        now: now.toISOString(),
        expiresAtRaw: invitation.expiresAt
      });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invitation is expired',
          details: {
            expiresAt: expiresAtDate.toISOString(),
            now: now.toISOString()
          }
        },
        { status: 403 }
      );
    }

    // Generate JWT token for the invitation
    const tokenPayload: InvitationToken = {
      invitationId: invitationDoc.id,
      roomName: invitation.roomName,
      ...(invitation.emailAllowed && { email: invitation.emailAllowed }),
      exp: Math.floor(expiresAtDate.getTime() / 1000),
      iat: Math.floor(Date.now() / 1000),
      oneUse: !invitation.waitingRoomEnabled, // Not single use if waiting room enabled
    };

    const inviteToken = signInvitationToken(tokenPayload);

    // Generate invite URL
    const inviteUrl = buildInviteUrl(inviteToken);

    return NextResponse.json({
      success: true,
      inviteUrl,
      invitationId: invitationDoc.id,
      roomName: invitation.roomName,
      expiresAt: expiresAtDate.toISOString(),
    });

  } catch (error) {
    console.error('Error getting invitation link:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}


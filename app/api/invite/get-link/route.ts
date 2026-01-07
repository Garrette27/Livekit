import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import jwt from 'jsonwebtoken';
import { InvitationToken } from '../../../../lib/types';

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

    let invitationDoc;
    
    if (invitationId) {
      invitationDoc = await db.collection('invitations').doc(invitationId).get();
    } else {
      // Find the most recent active invitation for this room
      const invitationsQuery = await db.collection('invitations')
        .where('roomName', '==', roomName)
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      
      if (invitationsQuery.empty) {
        return NextResponse.json(
          { success: false, error: 'No active invitation found for this room' },
          { status: 404 }
        );
      }
      
      invitationDoc = invitationsQuery.docs[0];
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
    let expiresAtDate: Date;
    if (invitation.expiresAt) {
      if (typeof invitation.expiresAt.toDate === 'function') {
        expiresAtDate = invitation.expiresAt.toDate();
      } else if (invitation.expiresAt instanceof Date) {
        expiresAtDate = invitation.expiresAt;
      } else if (invitation.expiresAt.seconds) {
        // Handle Firestore Timestamp format
        expiresAtDate = new Date(invitation.expiresAt.seconds * 1000);
      } else {
        // Try parsing as ISO string
        try {
          expiresAtDate = new Date(invitation.expiresAt);
        } catch {
          expiresAtDate = new Date(0);
        }
      }
    } else {
      // No expiration date means it never expires
      expiresAtDate = new Date('2099-12-31');
    }

    const now = new Date();
    const isExpired = expiresAtDate.getTime() > 0 && now > expiresAtDate;

    if (isExpired) {
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

    const inviteToken = jwt.sign(
      tokenPayload,
      process.env.LIVEKIT_API_SECRET || 'fallback-secret',
      { algorithm: 'HS256' }
    );

    // Generate invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const inviteUrl = `${baseUrl}/invite/${inviteToken}`;

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


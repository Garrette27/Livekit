import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { withRateLimit, RateLimitConfigs } from '../../../../lib/rate-limit';
import { validateEmail, validateRoomName, sanitizeInput } from '../../../../lib/validation';
import jwt from 'jsonwebtoken';
import { 
  CreateInvitationRequest, 
  CreateInvitationResponse, 
  Invitation,
  InvitationToken 
} from '../../../../lib/types';

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = withRateLimit(RateLimitConfigs.TOKEN_GENERATION)(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body: CreateInvitationRequest = await req.json();
    const { roomName, emailAllowed, phoneAllowed, expiresInHours, waitingRoomEnabled, maxPatients, maxUses, doctorUserId, doctorEmail, doctorName } = body;

    // Input validation - only roomName is required
    if (!roomName) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: roomName is required' },
        { status: 400 }
      );
    }

    // Validate inputs
    if (!validateRoomName(roomName)) {
      return NextResponse.json(
        { success: false, error: 'Invalid room name' },
        { status: 400 }
      );
    }

    // Validate email only if provided
    if (emailAllowed && !validateEmail(emailAllowed)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const sanitizedRoomName = sanitizeInput(roomName);
    const sanitizedEmail = emailAllowed ? sanitizeInput(emailAllowed.toLowerCase().trim()) : undefined;
    const sanitizedPhone = phoneAllowed ? sanitizeInput(phoneAllowed.trim()) : undefined;

    // Validate expiration time (1-168 hours = 1 hour to 1 week)
    const validExpirationHours = Math.max(1, Math.min(168, expiresInHours || 24));
    const expiresAt = new Date(Date.now() + validExpirationHours * 60 * 60 * 1000);

    // Get Firebase admin
    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    // Check if email already has an account (optional - for informational purposes)
    // Only check if email is provided
    let existingAccount = null;
    if (sanitizedEmail) {
      try {
        const existingUserQuery = await db.collection('users').where('email', '==', sanitizedEmail).limit(1).get();
        if (!existingUserQuery.empty) {
          existingAccount = {
            exists: true,
            uid: existingUserQuery.docs[0].id,
            userData: existingUserQuery.docs[0].data()
          };
          console.log('Email already has an account:', existingAccount);
        }
      } catch (error) {
        console.log('Could not check for existing account:', error);
        // Continue with invitation creation even if we can't check
      }
    }

    // Generate unique invitation ID
    const invitationId = `invite_${sanitizedRoomName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Determine waiting room settings
    const isWaitingRoomEnabled = waitingRoomEnabled === true;
    const finalMaxUses = maxUses !== undefined ? maxUses : (isWaitingRoomEnabled ? 999999 : 1); // Unlimited uses if waiting room enabled
    const finalMaxPatients = isWaitingRoomEnabled ? (maxPatients || 10) : 1;

    // Create invitation document
    const invitation: any = {
      roomName: sanitizedRoomName,
      expiresAt: expiresAt as any, // Firestore Timestamp
      maxUses: finalMaxUses,
      currentUses: 0, // Initialize current uses counter
      waitingRoomEnabled: isWaitingRoomEnabled,
      ...(isWaitingRoomEnabled && { maxPatients: finalMaxPatients }),
      createdBy: doctorUserId || 'system', // Use provided doctor user ID or fallback to 'system'
      createdAt: new Date() as any,
      status: 'active',
      metadata: {
        createdBy: doctorUserId || 'system',
        doctorName: doctorName || 'Dr. System',
        doctorEmail: doctorEmail || 'system@example.com',
        roomName: sanitizedRoomName,
        constraints: {
          ...(sanitizedEmail && { email: sanitizedEmail }),
          ...(sanitizedPhone && { phone: sanitizedPhone }),
        },
        security: {
          singleUse: !isWaitingRoomEnabled, // Not single use if waiting room enabled
          timeLimited: true,
          // Removed: geoRestricted, deviceRestricted - now handled via user profile verification
        },
      },
      audit: {
        created: new Date() as any,
        accessAttempts: [],
        violations: [],
      },
    };

    // Add email if provided
    if (sanitizedEmail) {
      invitation.emailAllowed = sanitizedEmail;
    }

    // Add phone if provided
    if (sanitizedPhone) {
      invitation.phoneAllowed = sanitizedPhone;
    }

    // Store invitation in Firestore
    try {
      await db.collection('invitations').doc(invitationId).set(invitation);
      console.log('Invitation stored successfully in Firestore');
    } catch (firestoreError) {
      console.error('Firestore error:', firestoreError);
      const errorMessage = firestoreError instanceof Error ? firestoreError.message : 'Unknown Firestore error';
      throw new Error(`Failed to store invitation: ${errorMessage}`);
    }

    // Generate JWT token for the invitation
    const tokenPayload: InvitationToken = {
      invitationId,
      roomName: sanitizedRoomName,
      ...(sanitizedEmail && { email: sanitizedEmail }), // Only include email if provided
      exp: Math.floor(expiresAt.getTime() / 1000),
      iat: Math.floor(Date.now() / 1000),
      oneUse: true,
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

    // Debug logging for URL generation
    console.log('Environment variables for URL generation:', {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      VERCEL_URL: process.env.VERCEL_URL,
      baseUrl: baseUrl,
      inviteUrl: inviteUrl
    });

    const response: CreateInvitationResponse = {
      success: true,
      invitationId,
      inviteUrl,
      expiresAt: expiresAt.toISOString(),
      existingAccount: existingAccount ? {
        exists: true,
        message: 'This email already has an account. The invitation will still work for joining the consultation.'
      } : null,
    };

    console.log('Invitation created successfully:', {
      invitationId,
      roomName: sanitizedRoomName,
      email: sanitizedEmail || 'none',
      expiresAt: expiresAt.toISOString(),
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

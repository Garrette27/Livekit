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
    const { roomName, emailAllowed, countryAllowlist, browserAllowlist, deviceBinding, expiresInHours, allowedIpAddresses, allowedDeviceIds } = body;

    // Input validation
    if (!roomName || !emailAllowed || !countryAllowlist || !browserAllowlist) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
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

    if (!validateEmail(emailAllowed)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    if (!Array.isArray(countryAllowlist) || countryAllowlist.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Country allowlist must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!Array.isArray(browserAllowlist) || browserAllowlist.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Browser allowlist must be a non-empty array' },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const sanitizedRoomName = sanitizeInput(roomName);
    const sanitizedEmail = sanitizeInput(emailAllowed);
    const sanitizedCountries = countryAllowlist.map(c => sanitizeInput(c));
    const sanitizedBrowsers = browserAllowlist.map(b => sanitizeInput(b));
    const sanitizedAllowedIps = (allowedIpAddresses || []).map(ip => sanitizeInput(ip));
    const sanitizedAllowedDevices = (allowedDeviceIds || []).map(id => sanitizeInput(id));

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

    // Generate unique invitation ID
    const invitationId = `invite_${sanitizedRoomName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create invitation document - only include fields that have values
    const invitation: any = {
      roomName: sanitizedRoomName,
      emailAllowed: sanitizedEmail,
      countryAllowlist: sanitizedCountries,
      browserAllowlist: sanitizedBrowsers,
      expiresAt: expiresAt as any, // Firestore Timestamp
      maxUses: 1, // Single use
      createdBy: 'system', // TODO: Get from auth context
      createdAt: new Date() as any,
      status: 'active',
      metadata: {
        createdBy: 'system', // TODO: Get from auth context
        doctorName: 'Dr. System', // TODO: Get from auth context
        doctorEmail: 'system@example.com', // TODO: Get from auth context
        roomName: sanitizedRoomName,
        constraints: {
          email: sanitizedEmail,
          countries: sanitizedCountries,
          browsers: sanitizedBrowsers,
          deviceBinding: deviceBinding || false,
        },
        security: {
          singleUse: true,
          timeLimited: true,
          geoRestricted: true,
          deviceRestricted: deviceBinding || false,
        },
      },
      audit: {
        created: new Date() as any,
        accessAttempts: [],
        violations: [],
      },
    };

    // Debug logging
    console.log('Creating invitation with data:', {
      sanitizedAllowedIps: sanitizedAllowedIps,
      sanitizedAllowedDevices: sanitizedAllowedDevices,
      deviceBinding: deviceBinding
    });

    // Only add optional fields if they have values
    if (sanitizedAllowedIps.length > 0) {
      invitation.allowedIpAddresses = sanitizedAllowedIps;
    }
    
    if (sanitizedAllowedDevices.length > 0) {
      invitation.allowedDeviceIds = sanitizedAllowedDevices;
    }
    
    if (deviceBinding) {
      invitation.deviceFingerprintHash = null; // Will be set on first access
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
      email: sanitizedEmail,
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
    };

    console.log('Invitation created successfully:', {
      invitationId,
      roomName: sanitizedRoomName,
      email: sanitizedEmail,
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

import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { withRateLimit, RateLimitConfigs } from '../../../../lib/rate-limit';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { 
  ValidateInvitationRequest, 
  ValidateInvitationResponse, 
  Invitation,
  InvitationToken,
  AccessAttempt,
  SecurityViolation,
  DeviceFingerprint,
  GeolocationData,
  WaitingPatient
} from '../../../../lib/types';

// Helper function to get client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return (request as any).ip || 'unknown';
}

// Helper function to get geolocation from IP
async function getGeolocationFromIP(ip: string): Promise<GeolocationData | null> {
  try {
    // Using a free IP geolocation service (you can replace with a paid service for better accuracy)
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,city,timezone,isp`);
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        ip,
        country: data.country,
        countryCode: data.countryCode,
        region: data.region,
        city: data.city,
        timezone: data.timezone,
        isp: data.isp,
      };
    }
  } catch (error) {
    console.error('Error getting geolocation:', error);
  }
  
  return null;
}

// Helper function to generate device fingerprint hash
function generateDeviceFingerprintHash(deviceData: DeviceFingerprint): string {
  const fingerprintString = [
    deviceData.userAgent,
    deviceData.language,
    deviceData.platform,
    deviceData.screenResolution,
    deviceData.timezone,
    deviceData.cookieEnabled.toString(),
    deviceData.doNotTrack,
  ].join('|');
  
  return crypto.createHash('sha256').update(fingerprintString).digest('hex');
}

// Helper function to detect browser from user agent
function detectBrowser(userAgent: string): string {
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  return 'Unknown';
}

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = withRateLimit(RateLimitConfigs.TOKEN_GENERATION)(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body: ValidateInvitationRequest = await req.json();
    const { token, deviceFingerprint, userEmail } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    // Verify JWT token
    let tokenPayload: InvitationToken;
    try {
      tokenPayload = jwt.verify(token, process.env.LIVEKIT_API_SECRET || 'fallback-secret') as InvitationToken;
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired invitation token' },
        { status: 401 }
      );
    }

    // Get Firebase admin
    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    // Get invitation from database
    const invitationDoc = await db.collection('invitations').doc(tokenPayload.invitationId).get();
    if (!invitationDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Invitation not found' },
        { status: 404 }
      );
    }

    const invitation = invitationDoc.data() as Invitation;
    
    // Log invitation details for debugging
    console.log('Invitation retrieved for waiting room:', {
      invitationId: tokenPayload.invitationId,
      createdBy: invitation.createdBy,
      waitingRoomEnabled: invitation.waitingRoomEnabled,
      roomName: invitation.roomName
    });

    // Check if invitation is expired (always check this first)
    // Handle both Firestore Timestamp and Date objects
    let expiresAtDate: Date;
    if (invitation.expiresAt && typeof invitation.expiresAt.toDate === 'function') {
      expiresAtDate = invitation.expiresAt.toDate();
    } else if (invitation.expiresAt instanceof Date) {
      expiresAtDate = invitation.expiresAt;
    } else {
      // Fallback: try to parse as timestamp
      expiresAtDate = new Date((invitation.expiresAt as any)?.seconds * 1000 || Date.now());
    }

    if (invitation.status === 'expired' || new Date() > expiresAtDate) {
      return NextResponse.json(
        { success: false, error: 'Invitation has expired' },
        { status: 403 }
      );
    }

    // Check if invitation is cancelled or revoked
    if (invitation.status === 'cancelled' || invitation.status === 'revoked') {
      return NextResponse.json(
        { success: false, error: 'Invitation has been cancelled or revoked' },
        { status: 403 }
      );
    }

    // Get client information
    const clientIP = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || '';
    const geolocation = await getGeolocationFromIP(clientIP);
    const detectedBrowser = detectBrowser(userAgent);

    // Track access attempt
    const accessAttempt: AccessAttempt = {
      timestamp: new Date() as any,
      ip: clientIP,
      userAgent,
      country: geolocation?.country,
      deviceFingerprint: deviceFingerprint ? generateDeviceFingerprintHash(deviceFingerprint) : undefined,
      success: false, // Will be set to true if all validations pass
      reason: undefined,
    };

    const violations: SecurityViolation[] = [];

    // Check if user is registered (only if email is provided in invitation)
    let userEmailToCheck: string | undefined = userEmail || tokenPayload.email || invitation.emailAllowed;
    let userQuery: any = { empty: true };
    let userProfile: any = null;

    // Only check user registration if email is provided
    if (userEmailToCheck) {
      userEmailToCheck = userEmailToCheck.toLowerCase().trim();
      userQuery = await db.collection('users')
        .where('email', '==', userEmailToCheck)
        .limit(1)
        .get();

      // If user is not registered, require registration
      if (userQuery.empty) {
        return NextResponse.json({
          success: false,
          error: 'User not registered. Please register first.',
          requiresRegistration: true,
          registeredEmail: invitation.emailAllowed || userEmailToCheck,
        } as ValidateInvitationResponse, { status: 403 });
      }

      userProfile = userQuery.docs[0].data();

      // Check if consent was given - if not, require consent again
      if (!userProfile.consentGiven) {
        // User is registered but hasn't given consent yet
        return NextResponse.json({
          success: false,
          error: 'Consent required. Please provide consent to store device information.',
          requiresRegistration: true, // Show registration form to get consent
          registeredEmail: invitation.emailAllowed || userEmailToCheck,
        } as ValidateInvitationResponse, { status: 403 });
      }

      // Validate email matches invitation (only if invitation has email constraint)
      if (invitation.emailAllowed && userEmailToCheck !== invitation.emailAllowed.toLowerCase().trim()) {
        violations.push({
          timestamp: new Date() as any,
          type: 'wrong_email',
          details: `Expected: ${invitation.emailAllowed}, Got: ${userEmailToCheck}`,
          ip: clientIP,
          userAgent,
        });
      }
    } else {
      // No email provided - invitation is open (no email constraint)
      // Allow access without email validation
      console.log('Open invitation (no email constraint) - allowing access');
    }

    // Validate device fingerprint if device info exists (only if user is registered)
    // Note: If user just registered via invitation, device info might not match yet
    // We allow first access after registration, but subsequent accesses must match
    if (userProfile && deviceFingerprint && userProfile.deviceInfo) {
      const currentDeviceHash = generateDeviceFingerprintHash(deviceFingerprint);
      if (userProfile.deviceInfo.deviceFingerprintHash !== currentDeviceHash) {
        // Check if this is the first access after registration (device info was just set)
        // Allow slight flexibility for first-time access
        violations.push({
          timestamp: new Date() as any,
          type: 'wrong_device',
          details: 'Device fingerprint does not match registered device',
          ip: clientIP,
          userAgent,
        });
      }
    } else if (userProfile && deviceFingerprint && !userProfile.deviceInfo) {
      // User is registered but device info not set yet - this shouldn't happen if consent was given
      // But allow access and update device info
      const deviceHash = generateDeviceFingerprintHash(deviceFingerprint);
      await db.collection('users').doc(userQuery.docs[0].id).update({
        'deviceInfo.deviceFingerprintHash': deviceHash,
        'deviceInfo.userAgent': deviceFingerprint.userAgent,
        'deviceInfo.platform': deviceFingerprint.platform,
        'deviceInfo.screenResolution': deviceFingerprint.screenResolution,
        'deviceInfo.timezone': deviceFingerprint.timezone,
        'browserInfo.name': detectedBrowser,
      });
    }

    // Validate location if location info exists (only if user is registered)
    if (userProfile && geolocation && userProfile.locationInfo) {
      if (userProfile.locationInfo.country !== geolocation.country &&
          userProfile.locationInfo.countryCode !== geolocation.countryCode) {
        violations.push({
          timestamp: new Date() as any,
          type: 'wrong_country',
          details: `Expected: ${userProfile.locationInfo.country} (${userProfile.locationInfo.countryCode}), Got: ${geolocation.country} (${geolocation.countryCode})`,
          ip: clientIP,
          userAgent,
        });
      }
    }

    // Validate browser if browser info exists (only if user is registered)
    if (userProfile && userProfile.browserInfo) {
      if (userProfile.browserInfo.name !== detectedBrowser) {
        violations.push({
          timestamp: new Date() as any,
          type: 'wrong_browser',
          details: `Expected: ${userProfile.browserInfo.name}, Got: ${detectedBrowser}`,
          ip: clientIP,
          userAgent,
        });
      }
    }

    // Debug logging for validation
    console.log('Validation debug info:', {
      invitationId: tokenPayload.invitationId,
      userEmail: userEmailToCheck || 'none (open invitation)',
      userRegistered: userProfile ? !userQuery.empty : false,
      consentGiven: userProfile?.consentGiven || false,
      clientIP,
      geolocation: geolocation ? {
        country: geolocation.country,
        countryCode: geolocation.countryCode
      } : null,
      detectedBrowser,
      userAgent
    });

    // If there are violations, record them and deny access
    if (violations.length > 0) {
      console.log('Security violations detected:', violations.map(v => ({
        type: v.type,
        details: v.details
      })));
      
      accessAttempt.reason = `Violations: ${violations.map(v => v.type).join(', ')}`;
      
      // Prepare access attempt data without undefined values for Firestore
      const accessAttemptData = {
        timestamp: accessAttempt.timestamp,
        ip: accessAttempt.ip,
        userAgent: accessAttempt.userAgent,
        success: accessAttempt.success,
        reason: accessAttempt.reason,
        ...(accessAttempt.country && { country: accessAttempt.country }),
        ...(accessAttempt.deviceFingerprint && { deviceFingerprint: accessAttempt.deviceFingerprint }),
      };
      
      // Update invitation with access attempt and violations
      await db.collection('invitations').doc(tokenPayload.invitationId).update({
        'audit.accessAttempts': [...(invitation.audit?.accessAttempts || []), accessAttemptData],
        'audit.violations': [...(invitation.audit?.violations || []), ...violations],
        'audit.lastAccessed': new Date(),
      });

      return NextResponse.json({
        success: false,
        error: 'Access denied due to security violations',
        violations,
      } as ValidateInvitationResponse, { status: 403 });
    }

    // Check if waiting room is enabled
    const isWaitingRoomEnabled = invitation.waitingRoomEnabled === true;
    const waitingRoomName = isWaitingRoomEnabled ? `${tokenPayload.roomName}-waiting` : tokenPayload.roomName;

    // If waiting room enabled, check current patients and max capacity
    if (isWaitingRoomEnabled) {
      const maxPatients = invitation.maxPatients || 10;
      const currentWaitingQuery = await db.collection('waitingPatients')
        .where('roomName', '==', tokenPayload.roomName)
        .where('invitationId', '==', tokenPayload.invitationId)
        .where('status', '==', 'waiting')
        .get();
      
      if (currentWaitingQuery.size >= maxPatients) {
        return NextResponse.json({
          success: false,
          error: `Waiting room is full. Maximum ${maxPatients} patients allowed.`,
        } as ValidateInvitationResponse, { status: 403 });
      }

      // Check if invitation has reached max uses
      const currentUses = invitation.currentUses || 0;
      if (invitation.maxUses && currentUses >= invitation.maxUses) {
        return NextResponse.json({
          success: false,
          error: 'Invitation has reached maximum number of uses.',
        } as ValidateInvitationResponse, { status: 403 });
      }
    } else {
      // If waiting room not enabled, check if invitation is already used (single use)
      // Check usedAt instead of status to avoid TypeScript narrowing issues
      if (invitation.usedAt) {
        return NextResponse.json({
          success: false,
          error: 'This invitation has already been used.',
        } as ValidateInvitationResponse, { status: 403 });
      }
    }

    // All validations passed - generate LiveKit token
    // If waiting room enabled, use waiting room name; otherwise use main room name
    const targetRoomName = isWaitingRoomEnabled ? waitingRoomName : tokenPayload.roomName;
    
    const liveKitToken = jwt.sign(
      {
        sub: `patient_${tokenPayload.invitationId}_${Date.now()}`,
        video: {
          roomJoin: true,
          room: targetRoomName,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        },
        audio: {
          roomJoin: true,
          room: targetRoomName,
          canPublish: true,
          canSubscribe: true,
        },
      },
      process.env.LIVEKIT_API_SECRET || 'fallback-secret',
      {
        issuer: process.env.LIVEKIT_API_KEY,
        expiresIn: '1h',
        algorithm: 'HS256',
      }
    );

    // Mark access attempt as successful
    accessAttempt.success = true;
    accessAttempt.reason = 'Access granted successfully';
    
    // Prepare access attempt data without undefined values for Firestore
    const accessAttemptData = {
      timestamp: accessAttempt.timestamp,
      ip: accessAttempt.ip,
      userAgent: accessAttempt.userAgent,
      success: accessAttempt.success,
      reason: accessAttempt.reason,
      ...(accessAttempt.country && { country: accessAttempt.country }),
      ...(accessAttempt.deviceFingerprint && { deviceFingerprint: accessAttempt.deviceFingerprint }),
    };

    // If waiting room enabled, check if patient was already admitted first
    if (isWaitingRoomEnabled) {
      // Check if there's already an admitted patient for this invitation
      // Use device fingerprint hash if available, or IP + userAgent as fallback
      const deviceFingerprintHash = deviceFingerprint?.hash || 
        (deviceFingerprint ? JSON.stringify(deviceFingerprint).substring(0, 50) : null);
      
      // First, check if patient was already admitted
      const existingPatientsQuery = await db.collection('waitingPatients')
        .where('invitationId', '==', tokenPayload.invitationId)
        .get();
      
      let existingAdmittedPatient = null;
      let existingWaitingPatient = null;
      
      if (!existingPatientsQuery.empty) {
        const existingPatients = existingPatientsQuery.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as WaitingPatient));
        
        // Check for waiting patient with matching device/IP (reuse existing waiting patients to avoid duplicates)
        // Note: We no longer auto-admit previously admitted patients - they must go through waiting room again
        const waitingPatients = existingPatients.filter(p => p.status === 'waiting');
        
        // Try to match by device fingerprint or IP + userAgent
        if (deviceFingerprintHash) {
          existingWaitingPatient = waitingPatients.find(p => {
            const fingerprint = p.metadata?.deviceFingerprint;
            if (typeof fingerprint === 'string') {
              return fingerprint.includes(deviceFingerprintHash.substring(0, 20));
            }
            return false;
          });
        }
        
        // Fallback: match by IP and userAgent (within last 5 minutes)
        if (!existingWaitingPatient) {
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
          existingWaitingPatient = waitingPatients.find(p => {
            const joinedTime = p.joinedAt?.toMillis?.() || 
                              (p.joinedAt instanceof Date ? p.joinedAt.getTime() : 
                               (p.joinedAt ? new Date(p.joinedAt as any).getTime() : 0));
            return p.metadata?.ip === clientIP && 
                   p.metadata?.userAgent === userAgent &&
                   joinedTime > fiveMinutesAgo;
          });
        }
      }
      
      // If there's an existing waiting patient (same device/IP), reuse it instead of creating duplicate
      if (existingWaitingPatient) {
        console.log('Existing waiting patient found, reusing instead of creating duplicate:', {
          waitingPatientId: existingWaitingPatient.id,
          invitationId: tokenPayload.invitationId
        });
        
        // Update last accessed time
        await db.collection('waitingPatients').doc(existingWaitingPatient.id).update({
          'metadata.lastAccessed': new Date(),
        });
        
        // Return waiting room token (reuse existing entry)
        return NextResponse.json({
          success: true,
          liveKitToken,
          roomName: waitingRoomName,
          waitingRoomToken: true,
          waitingRoomEnabled: true,
          invitationId: tokenPayload.invitationId,
        } as ValidateInvitationResponse);
      }
      
      // No existing patient found - create new waiting patient entry
      const waitingPatientId = `waiting_${tokenPayload.invitationId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Ensure doctorUserId is set correctly - use invitation.createdBy
      const doctorUserId = invitation.createdBy;
      
      if (!doctorUserId || doctorUserId === 'system') {
        console.error('⚠️ WARNING: Invitation createdBy is missing or "system":', {
          invitationId: tokenPayload.invitationId,
          createdBy: invitation.createdBy,
          invitationData: invitation
        });
      }

      // Use invitation email if available (even if patient is anonymous)
      const finalPatientEmail = userEmailToCheck || invitation.emailAllowed || undefined;
      
      const waitingPatient: any = {
        id: waitingPatientId,
        patientId: userProfile ? userQuery.docs[0].id : `anonymous_${Date.now()}`,
        patientName: userProfile?.email || userEmailToCheck || invitation.emailAllowed || 'Anonymous Patient',
        ...(finalPatientEmail && { patientEmail: finalPatientEmail }), // Include email from user or invitation
        roomName: tokenPayload.roomName,
        invitationId: tokenPayload.invitationId,
        doctorUserId: doctorUserId, // Store doctor's user ID for permission checking
        joinedAt: new Date(),
        status: 'waiting',
        metadata: {
          ...(deviceFingerprint && { deviceFingerprint: JSON.stringify(deviceFingerprint) }), // Only include if exists
          ip: clientIP,
          userAgent,
          lastAccessed: new Date(),
        },
      };

      console.log('Creating new waiting patient document:', {
        waitingPatientId,
        invitationId: tokenPayload.invitationId,
        doctorUserId: doctorUserId,
        createdBy: invitation.createdBy,
        roomName: tokenPayload.roomName,
        invitationData: {
          id: tokenPayload.invitationId,
          createdBy: invitation.createdBy,
          waitingRoomEnabled: invitation.waitingRoomEnabled
        }
      });
      
      // Validate doctorUserId before creating document
      if (!doctorUserId || doctorUserId === 'system') {
        console.error('❌ CRITICAL: Cannot create waiting patient - doctorUserId is invalid:', {
          doctorUserId,
          invitationCreatedBy: invitation.createdBy,
          invitationId: tokenPayload.invitationId
        });
        return NextResponse.json(
          { success: false, error: 'Invalid invitation: doctor not associated with invitation' },
          { status: 500 }
        );
      }

      await db.collection('waitingPatients').doc(waitingPatientId).set(waitingPatient);

      // Update invitation - increment currentUses, but don't mark as used
      const updateData: any = {
        currentUses: (invitation.currentUses || 0) + 1,
        'audit.accessAttempts': [...(invitation.audit?.accessAttempts || []), accessAttemptData],
        'audit.lastAccessed': new Date(),
      };

      await db.collection('invitations').doc(tokenPayload.invitationId).update(updateData);

      const response: ValidateInvitationResponse = {
        success: true,
        liveKitToken,
        roomName: waitingRoomName,
        waitingRoomToken: true,
        waitingRoomEnabled: true,
        invitationId: tokenPayload.invitationId,
      };

      console.log('Patient added to waiting room:', {
        waitingPatientId,
        roomName: tokenPayload.roomName,
        invitationId: tokenPayload.invitationId,
      });

      return NextResponse.json(response);
    }

    // No waiting room - direct access to main room (original behavior)
    await db.collection('invitations').doc(tokenPayload.invitationId).update({
      status: 'used',
      usedAt: new Date(),
      usedBy: clientIP,
      'audit.accessAttempts': [...(invitation.audit?.accessAttempts || []), accessAttemptData],
      'audit.lastAccessed': new Date(),
    });

    const response: ValidateInvitationResponse = {
      success: true,
      liveKitToken,
      roomName: tokenPayload.roomName,
      waitingRoomEnabled: false,
      invitationId: tokenPayload.invitationId,
    };

    console.log('Invitation validated successfully:', {
      invitationId: tokenPayload.invitationId,
      roomName: tokenPayload.roomName,
      ip: clientIP,
      country: geolocation?.country,
      browser: detectedBrowser,
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error validating invitation:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
  GeolocationData
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
    const { token, deviceFingerprint } = body;

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

    // Check if invitation is already used
    if (invitation.status === 'used') {
      return NextResponse.json(
        { success: false, error: 'Invitation has already been used' },
        { status: 403 }
      );
    }

    // Check if invitation is expired
    if (invitation.status === 'expired' || new Date() > invitation.expiresAt.toDate()) {
      return NextResponse.json(
        { success: false, error: 'Invitation has expired' },
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

    // Validate email (if provided in token)
    if (tokenPayload.email && tokenPayload.email !== invitation.emailAllowed) {
      violations.push({
        timestamp: new Date() as any,
        type: 'wrong_email',
        details: `Expected: ${invitation.emailAllowed}, Got: ${tokenPayload.email}`,
        ip: clientIP,
        userAgent,
      });
    }

    // Validate country - check both country name and country code
    if (geolocation) {
      const countryAllowed = invitation.countryAllowlist.some(allowedCountry => 
        allowedCountry === geolocation.country || 
        allowedCountry === geolocation.countryCode ||
        // Handle case where allowlist has country codes but geolocation has full names
        (allowedCountry === 'PH' && geolocation.country === 'Philippines') ||
        (allowedCountry === 'US' && geolocation.country === 'United States') ||
        (allowedCountry === 'GB' && geolocation.country === 'United Kingdom') ||
        (allowedCountry === 'CA' && geolocation.country === 'Canada') ||
        (allowedCountry === 'AU' && geolocation.country === 'Australia') ||
        (allowedCountry === 'DE' && geolocation.country === 'Germany') ||
        (allowedCountry === 'FR' && geolocation.country === 'France') ||
        (allowedCountry === 'IT' && geolocation.country === 'Italy') ||
        (allowedCountry === 'ES' && geolocation.country === 'Spain') ||
        (allowedCountry === 'NL' && geolocation.country === 'Netherlands') ||
        (allowedCountry === 'SE' && geolocation.country === 'Sweden') ||
        (allowedCountry === 'NO' && geolocation.country === 'Norway') ||
        (allowedCountry === 'DK' && geolocation.country === 'Denmark') ||
        (allowedCountry === 'FI' && geolocation.country === 'Finland') ||
        (allowedCountry === 'CH' && geolocation.country === 'Switzerland') ||
        (allowedCountry === 'AT' && geolocation.country === 'Austria') ||
        (allowedCountry === 'BE' && geolocation.country === 'Belgium') ||
        (allowedCountry === 'IE' && geolocation.country === 'Ireland') ||
        (allowedCountry === 'PT' && geolocation.country === 'Portugal') ||
        (allowedCountry === 'GR' && geolocation.country === 'Greece') ||
        (allowedCountry === 'PL' && geolocation.country === 'Poland') ||
        (allowedCountry === 'CZ' && geolocation.country === 'Czech Republic') ||
        (allowedCountry === 'HU' && geolocation.country === 'Hungary') ||
        (allowedCountry === 'SK' && geolocation.country === 'Slovakia') ||
        (allowedCountry === 'SI' && geolocation.country === 'Slovenia') ||
        (allowedCountry === 'HR' && geolocation.country === 'Croatia') ||
        (allowedCountry === 'RO' && geolocation.country === 'Romania') ||
        (allowedCountry === 'BG' && geolocation.country === 'Bulgaria') ||
        (allowedCountry === 'LT' && geolocation.country === 'Lithuania') ||
        (allowedCountry === 'LV' && geolocation.country === 'Latvia') ||
        (allowedCountry === 'EE' && geolocation.country === 'Estonia') ||
        (allowedCountry === 'JP' && geolocation.country === 'Japan') ||
        (allowedCountry === 'KR' && geolocation.country === 'South Korea') ||
        (allowedCountry === 'CN' && geolocation.country === 'China') ||
        (allowedCountry === 'IN' && geolocation.country === 'India') ||
        (allowedCountry === 'SG' && geolocation.country === 'Singapore') ||
        (allowedCountry === 'HK' && geolocation.country === 'Hong Kong') ||
        (allowedCountry === 'TW' && geolocation.country === 'Taiwan') ||
        (allowedCountry === 'TH' && geolocation.country === 'Thailand') ||
        (allowedCountry === 'MY' && geolocation.country === 'Malaysia') ||
        (allowedCountry === 'ID' && geolocation.country === 'Indonesia') ||
        (allowedCountry === 'VN' && geolocation.country === 'Vietnam') ||
        (allowedCountry === 'BR' && geolocation.country === 'Brazil') ||
        (allowedCountry === 'MX' && geolocation.country === 'Mexico') ||
        (allowedCountry === 'AR' && geolocation.country === 'Argentina') ||
        (allowedCountry === 'CL' && geolocation.country === 'Chile') ||
        (allowedCountry === 'CO' && geolocation.country === 'Colombia') ||
        (allowedCountry === 'PE' && geolocation.country === 'Peru') ||
        (allowedCountry === 'ZA' && geolocation.country === 'South Africa') ||
        (allowedCountry === 'EG' && geolocation.country === 'Egypt') ||
        (allowedCountry === 'NG' && geolocation.country === 'Nigeria') ||
        (allowedCountry === 'KE' && geolocation.country === 'Kenya') ||
        (allowedCountry === 'MA' && geolocation.country === 'Morocco') ||
        (allowedCountry === 'TN' && geolocation.country === 'Tunisia') ||
        (allowedCountry === 'DZ' && geolocation.country === 'Algeria') ||
        (allowedCountry === 'LY' && geolocation.country === 'Libya') ||
        (allowedCountry === 'SD' && geolocation.country === 'Sudan') ||
        (allowedCountry === 'ET' && geolocation.country === 'Ethiopia') ||
        (allowedCountry === 'GH' && geolocation.country === 'Ghana') ||
        (allowedCountry === 'UG' && geolocation.country === 'Uganda') ||
        (allowedCountry === 'TZ' && geolocation.country === 'Tanzania') ||
        (allowedCountry === 'ZM' && geolocation.country === 'Zambia') ||
        (allowedCountry === 'ZW' && geolocation.country === 'Zimbabwe') ||
        (allowedCountry === 'BW' && geolocation.country === 'Botswana') ||
        (allowedCountry === 'NA' && geolocation.country === 'Namibia') ||
        (allowedCountry === 'SZ' && geolocation.country === 'Eswatini') ||
        (allowedCountry === 'LS' && geolocation.country === 'Lesotho') ||
        (allowedCountry === 'MW' && geolocation.country === 'Malawi') ||
        (allowedCountry === 'MZ' && geolocation.country === 'Mozambique') ||
        (allowedCountry === 'MG' && geolocation.country === 'Madagascar') ||
        (allowedCountry === 'MU' && geolocation.country === 'Mauritius') ||
        (allowedCountry === 'SC' && geolocation.country === 'Seychelles') ||
        (allowedCountry === 'KM' && geolocation.country === 'Comoros') ||
        (allowedCountry === 'DJ' && geolocation.country === 'Djibouti') ||
        (allowedCountry === 'SO' && geolocation.country === 'Somalia') ||
        (allowedCountry === 'ER' && geolocation.country === 'Eritrea') ||
        (allowedCountry === 'SS' && geolocation.country === 'South Sudan') ||
        (allowedCountry === 'CF' && geolocation.country === 'Central African Republic') ||
        (allowedCountry === 'TD' && geolocation.country === 'Chad') ||
        (allowedCountry === 'NE' && geolocation.country === 'Niger') ||
        (allowedCountry === 'ML' && geolocation.country === 'Mali') ||
        (allowedCountry === 'BF' && geolocation.country === 'Burkina Faso') ||
        (allowedCountry === 'CI' && geolocation.country === 'Côte d\'Ivoire') ||
        (allowedCountry === 'LR' && geolocation.country === 'Liberia') ||
        (allowedCountry === 'SL' && geolocation.country === 'Sierra Leone') ||
        (allowedCountry === 'GN' && geolocation.country === 'Guinea') ||
        (allowedCountry === 'GW' && geolocation.country === 'Guinea-Bissau') ||
        (allowedCountry === 'GM' && geolocation.country === 'Gambia') ||
        (allowedCountry === 'SN' && geolocation.country === 'Senegal') ||
        (allowedCountry === 'MR' && geolocation.country === 'Mauritania') ||
        (allowedCountry === 'CV' && geolocation.country === 'Cape Verde') ||
        (allowedCountry === 'ST' && geolocation.country === 'São Tomé and Príncipe') ||
        (allowedCountry === 'GQ' && geolocation.country === 'Equatorial Guinea') ||
        (allowedCountry === 'GA' && geolocation.country === 'Gabon') ||
        (allowedCountry === 'CG' && geolocation.country === 'Republic of the Congo') ||
        (allowedCountry === 'CD' && geolocation.country === 'Democratic Republic of the Congo') ||
        (allowedCountry === 'AO' && geolocation.country === 'Angola') ||
        (allowedCountry === 'CM' && geolocation.country === 'Cameroon')
      );
      
      if (!countryAllowed) {
        violations.push({
          timestamp: new Date() as any,
          type: 'wrong_country',
          details: `Expected: ${invitation.countryAllowlist.join(', ')}, Got: ${geolocation.country} (${geolocation.countryCode})`,
          ip: clientIP,
          userAgent,
        });
      }
    }

    // Debug logging for validation
    console.log('Validation debug info:', {
      invitationId: tokenPayload.invitationId,
      clientIP,
      geolocation: geolocation ? {
        country: geolocation.country,
        countryCode: geolocation.countryCode
      } : null,
      detectedBrowser,
      countryAllowlist: invitation.countryAllowlist,
      browserAllowlist: invitation.browserAllowlist,
      userAgent
    });

    // Validate browser
    if (!invitation.browserAllowlist.includes(detectedBrowser)) {
      violations.push({
        timestamp: new Date() as any,
        type: 'wrong_browser',
        details: `Expected: ${invitation.browserAllowlist.join(', ')}, Got: ${detectedBrowser}`,
        ip: clientIP,
        userAgent,
      });
    }

    // Validate IP allowlist if provided
    if (invitation.allowedIpAddresses && invitation.allowedIpAddresses.length > 0) {
      const ipAllowed = invitation.allowedIpAddresses.some(ip => ip.trim() === clientIP);
      if (!ipAllowed) {
        violations.push({
          timestamp: new Date() as any,
          type: 'wrong_ip',
          details: `IP ${clientIP} not in allowlist`,
          ip: clientIP,
          userAgent,
        });
      }
    }

    // Validate device ID allowlist if provided (raw visitorId or hash)
    if (invitation.allowedDeviceIds && invitation.allowedDeviceIds.length > 0 && deviceFingerprint) {
      const deviceHash = generateDeviceFingerprintHash(deviceFingerprint);
      const rawId = deviceFingerprint.hash || '';
      const deviceAllowed = invitation.allowedDeviceIds.some(id => id === rawId || id === deviceHash);
      if (!deviceAllowed) {
        violations.push({
          timestamp: new Date() as any,
          type: 'wrong_device',
          details: 'Device ID not in allowlist',
          ip: clientIP,
          userAgent,
        });
      }
    }

    // Validate device fingerprint (if device binding is enabled)
    if (invitation.metadata.security.deviceRestricted && deviceFingerprint) {
      const deviceHash = generateDeviceFingerprintHash(deviceFingerprint);
      
      if (invitation.deviceFingerprintHash && invitation.deviceFingerprintHash !== deviceHash) {
        violations.push({
          timestamp: new Date() as any,
          type: 'wrong_device',
          details: 'Device fingerprint does not match',
          ip: clientIP,
          userAgent,
        });
      } else if (!invitation.deviceFingerprintHash) {
        // First time access - bind the device
        await db.collection('invitations').doc(tokenPayload.invitationId).update({
          deviceFingerprintHash: deviceHash,
        });
      }
    }

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

    // All validations passed - generate LiveKit token
    const liveKitToken = jwt.sign(
      {
        sub: `patient_${tokenPayload.invitationId}`,
        video: {
          roomJoin: true,
          room: tokenPayload.roomName,
        },
      },
      process.env.LIVEKIT_API_SECRET || 'fallback-secret',
      {
        issuer: process.env.LIVEKIT_API_KEY,
        expiresIn: '1h',
        algorithm: 'HS256',
      }
    );

    // Mark invitation as used
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

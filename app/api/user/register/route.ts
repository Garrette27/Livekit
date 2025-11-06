import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { withRateLimit, RateLimitConfigs } from '../../../../lib/rate-limit';
import { validateEmail, sanitizeInput } from '../../../../lib/validation';
import crypto from 'crypto';
import { 
  RegisterUserRequest, 
  RegisterUserResponse,
  DeviceFingerprint,
  GeolocationData
} from '../../../../lib/types';

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

// Helper function to hash IP address for privacy
function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
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

    const body: RegisterUserRequest = await req.json();
    const { email, phone, consentGiven, deviceFingerprint, geolocation } = body;

    // Validate required fields
    if (!email || !consentGiven || !deviceFingerprint) {
      return NextResponse.json(
        { success: false, error: 'Email, consent, and device fingerprint are required' },
        { status: 400 }
      );
    }

    // Validate email
    if (!validateEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Check if consent is given
    if (!consentGiven) {
      return NextResponse.json(
        { success: false, error: 'Consent is required to store device information', requiresConsent: true },
        { status: 400 }
      );
    }

    // Get client IP for geolocation if not provided
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Get Firebase admin
    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    // Sanitize inputs
    const sanitizedEmail = sanitizeInput(email.toLowerCase().trim());
    const sanitizedPhone = phone ? sanitizeInput(phone.trim()) : undefined;

    // Check if user already exists
    const existingUserQuery = await db.collection('users')
      .where('email', '==', sanitizedEmail)
      .limit(1)
      .get();

    const deviceHash = generateDeviceFingerprintHash(deviceFingerprint);
    const detectedBrowser = detectBrowser(deviceFingerprint.userAgent);
    const ipHash = hashIP(clientIP);

    // Prepare user profile data
    const userProfileData: any = {
      email: sanitizedEmail,
      consentGiven: true,
      consentGivenAt: new Date(),
      deviceInfo: {
        deviceFingerprintHash: deviceHash,
        userAgent: deviceFingerprint.userAgent,
        platform: deviceFingerprint.platform,
        screenResolution: deviceFingerprint.screenResolution,
        timezone: deviceFingerprint.timezone,
      },
      browserInfo: {
        name: detectedBrowser,
      },
      lastLoginAt: new Date(),
    };

    if (sanitizedPhone) {
      userProfileData.phone = sanitizedPhone;
    }

    // Add location info if geolocation is provided
    if (geolocation) {
      userProfileData.locationInfo = {
        country: geolocation.country,
        countryCode: geolocation.countryCode,
        region: geolocation.region,
        city: geolocation.city,
        ipHash: ipHash,
      };
    } else {
      // Try to get geolocation from IP if not provided
      try {
        const geoResponse = await fetch(`http://ip-api.com/json/${clientIP}?fields=status,country,countryCode,region,city`);
        const geoData = await geoResponse.json();
        if (geoData.status === 'success') {
          userProfileData.locationInfo = {
            country: geoData.country,
            countryCode: geoData.countryCode,
            region: geoData.region,
            city: geoData.city,
            ipHash: ipHash,
          };
        }
      } catch (error) {
        console.error('Error fetching geolocation:', error);
        // Continue without location info
      }
    }

    let userId: string;

    if (!existingUserQuery.empty) {
      // Update existing user
      userId = existingUserQuery.docs[0].id;
      userProfileData.registeredAt = existingUserQuery.docs[0].data().registeredAt || new Date();
      
      await db.collection('users').doc(userId).update(userProfileData);
      console.log('Updated existing user profile:', userId);
    } else {
      // Create new user
      userProfileData.registeredAt = new Date();
      
      const userRef = await db.collection('users').add(userProfileData);
      userId = userRef.id;
      console.log('Created new user profile:', userId);
    }

    const response: RegisterUserResponse = {
      success: true,
      userId,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}


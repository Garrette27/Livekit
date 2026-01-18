import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdmin } from './firebase-admin';
import { withRateLimit, RateLimitConfig, RateLimitConfigs } from './rate-limit';
import { getClientIP, getGeolocationFromIP, generateDeviceFingerprintHash, hashIP } from './device-utils';
import { DeviceFingerprint } from './types';

export interface ApiHandlerConfig {
  rateLimitConfig?: RateLimitConfig;
  requireAuth?: boolean;
  validateRequest?: (data: any) => string | null;
}

export function withApiHandler<T = any>(
  handler: (req: NextRequest, context: { data: T; ip: string; deviceFingerprint?: string; geolocation?: any }) => Promise<NextResponse>,
  config: ApiHandlerConfig = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Rate limiting
      if (config.rateLimitConfig) {
        const rateLimitMiddleware = withRateLimit(config.rateLimitConfig);
        const rateLimitResult = rateLimitMiddleware(req);
        if (rateLimitResult) return NextResponse.json(await rateLimitResult.json(), { status: rateLimitResult.status });
      }

      // Get client IP
      const ip = getClientIP(req);
      const hashedIP = hashIP(ip);

      // Parse request body
      let data: T;
      try {
        data = await req.json();
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid JSON in request body' },
          { status: 400 }
        );
      }

      // Validate request
      if (config.validateRequest) {
        const validationError = config.validateRequest(data);
        if (validationError) {
          return NextResponse.json(
            { error: validationError },
            { status: 400 }
          );
        }
      }

      // Handle device fingerprinting if present
      let deviceFingerprint: string | undefined;
      let geolocation: any;

      if (data && typeof data === 'object' && 'deviceFingerprint' in data) {
        deviceFingerprint = generateDeviceFingerprintHash(data.deviceFingerprint as DeviceFingerprint);
        geolocation = await getGeolocationFromIP(ip);
      }

      // Call the handler
      return await handler(req, { data, ip, deviceFingerprint, geolocation });

    } catch (error) {
      console.error('API handler error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

export function createSuccessResponse<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data });
}

export function createErrorResponse(error: string, status: number = 400): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}
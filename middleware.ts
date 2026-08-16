import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for access validation and security enforcement
 * Handles invitation link validation and security checks
 */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle invitation links
  if (pathname.startsWith('/invite/')) {
    return handleInvitationAccess(request);
  }

  // Handle patient room access
  if (pathname.startsWith('/room/') && pathname.includes('/patient')) {
    return handlePatientRoomAccess(request);
  }

  // Handle doctor room access
  if (pathname.startsWith('/room/') && pathname.includes('/doctor')) {
    return handleDoctorRoomAccess(request);
  }

  // Continue with normal processing for other routes
  return NextResponse.next();
}

function handleInvitationAccess(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = pathname.split('/invite/')[1];

  if (!token) {
    return NextResponse.redirect(new URL('/access-denied?reason=invalid-link', request.url));
  }

  // Basic token format validation
  if (!token.includes('.') || token.split('.').length !== 3) {
    return NextResponse.redirect(new URL('/access-denied?reason=invalid-token', request.url));
  }

  // Add security headers
  const response = NextResponse.next();
  addSecurityHeaders(response, request);
  
  return response;
}

function handlePatientRoomAccess(request: NextRequest) {
  // Referer is optional and spoofable, so it is never an authorization
  // boundary. The page requires the signed, room-scoped token established by
  // invitation validation and otherwise renders its secure-invitation state.
  const response = NextResponse.next();
  addSecurityHeaders(response, request);
  
  return response;
}

function handleDoctorRoomAccess(request: NextRequest) {
  // Doctor rooms can be accessed directly (they authenticate separately)
  // Add security headers to allow camera and microphone access
  const response = NextResponse.next();
  addSecurityHeaders(response, request);
  
  return response;
}

function shouldEnableUpgradeInsecureRequests(request: NextRequest): boolean {
  const protocol = request.nextUrl.protocol;
  const hostname = request.nextUrl.hostname.toLowerCase();

  if (protocol !== 'https:') {
    return false;
  }

  return hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1';
}

/**
 * Apply route security headers while preserving local/dev browser compatibility.
 */
function addSecurityHeaders(response: NextResponse, request: NextRequest) {
  // Add security headers for invitation pages
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Allow camera and microphone on this origin so LiveKit can access devices
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  
  // Content Security Policy for invitation pages
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://www.gstatic.com https://www.google.com https://apis.google.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.livekit.cloud wss://*.livekit.cloud https://*.firebaseapp.com https://*.web.app https://*.googleapis.com https://www.google.com https://apis.google.com https://securetoken.google.com https://identitytoolkit.googleapis.com",
    "media-src 'self' https://*.livekit.cloud",
    "frame-src 'self' https://accounts.google.com https://apis.google.com https://www.gstatic.com https://*.firebaseapp.com https://*.web.app",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (shouldEnableUpgradeInsecureRequests(request)) {
    cspDirectives.push('upgrade-insecure-requests');
  }
  
  const csp = cspDirectives.join('; ');
  
  response.headers.set('Content-Security-Policy', csp);
  
  return response;
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    '/invite/:path*',
    '/room/:path*/patient',
    '/room/:path*/doctor',
    '/access-denied'
  ]
};

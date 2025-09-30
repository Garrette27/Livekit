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
  addSecurityHeaders(response);
  
  return response;
}

function handlePatientRoomAccess(request: NextRequest) {
  // Check if this is a direct patient room access (not through invitation)
  const referer = request.headers.get('referer');
  
  if (!referer || !referer.includes('/invite/')) {
    // Direct access to patient room without invitation - redirect to access denied
    return NextResponse.redirect(new URL('/access-denied?reason=direct-access', request.url));
  }

  // Add security headers
  const response = NextResponse.next();
  addSecurityHeaders(response);
  
  return response;
}

function addSecurityHeaders(response: NextResponse) {
  // Add security headers for invitation pages
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Allow camera and microphone on this origin so LiveKit can access devices
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  
  // Content Security Policy for invitation pages
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://api.openai.com https://*.livekit.cloud wss://*.livekit.cloud",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', csp);
  
  return response;
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    '/invite/:path*',
    '/room/:path*/patient',
    '/access-denied'
  ]
};

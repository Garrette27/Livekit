import { getFirebaseAdminAuth } from '@/lib/firebase-admin';
import { recordAuthenticatedUser } from './request-logging';
import { serviceError, serviceOk, type ServiceResult } from './service-result';

export interface AuthenticatedRequester {
  userId: string;
  email?: string;
}

/**
 * Verifies a Firebase ID token from the request's `Authorization: Bearer`
 * header and resolves the caller's identity. Returns a ServiceResult so route
 * handlers can map auth failures to HTTP the same way as any other outcome,
 * instead of repeating the token-parsing/verification dance per route.
 */
export async function authenticateBearerToken(
  req: Request
): Promise<ServiceResult<AuthenticatedRequester>> {
  const auth = getFirebaseAdminAuth();
  if (!auth) {
    return serviceError(500, 'auth_unavailable', 'Firebase Admin not initialized');
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return serviceError(401, 'missing_token', 'Authorization token required');
  }

  try {
    const decoded = await auth.verifyIdToken(authHeader.substring(7));
    recordAuthenticatedUser(decoded.uid);
    return serviceOk({ userId: decoded.uid, email: decoded.email });
  } catch (error) {
    console.error('Token verification error:', error);
    return serviceError(401, 'invalid_token', 'Invalid or expired token');
  }
}

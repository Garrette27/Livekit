import { getFirebaseAdmin, getFirebaseAdminAuth } from '@/lib/firebase-admin';
import {
  parseAppRole,
  roleHasPermission,
  type AppPermission,
  type AppRole,
} from '@/lib/auth/access-policy';
import { UserRepository } from '@/lib/repositories/user-repository';
import { recordAuthenticatedUser } from './request-logging';
import { serviceError, serviceOk, type ServiceResult } from './service-result';
import {
  DATABASE_UNAVAILABLE_CODE,
  DATABASE_UNAVAILABLE_MESSAGE,
  isDatabaseUnavailableError,
} from './database-availability';

export interface AuthenticatedRequester {
  userId: string;
  email?: string;
  /** Firebase `email_verified`: the provider attests the caller controls `email`. */
  emailVerified: boolean;
  claimedRole?: AppRole;
  isAdminClaim: boolean;
}

export interface AuthorizedRequester extends AuthenticatedRequester {
  role: AppRole;
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
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return serviceError(401, 'missing_token', 'Authorization token required');
  }

  const auth = getFirebaseAdminAuth();
  if (!auth) {
    return serviceError(500, 'auth_unavailable', 'Firebase Admin not initialized');
  }

  try {
    const decoded = await auth.verifyIdToken(authHeader.substring(7));
    recordAuthenticatedUser(decoded.uid);
    return serviceOk({
      userId: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified === true,
      claimedRole: parseAppRole(decoded.role) || undefined,
      isAdminClaim: decoded.admin === true,
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return serviceError(401, 'invalid_token', 'Invalid or expired token');
  }
}

/**
 * Authenticates a request and resolves its role from trusted custom claims or
 * the user's server-read profile, then applies the centralized permission
 * policy. Resource ownership remains the responsibility of the domain service.
 */
export async function authorizeBearerRequest(
  req: Request,
  permission: AppPermission
): Promise<ServiceResult<AuthorizedRequester>> {
  const authenticated = await authenticateBearerToken(req);
  if (!authenticated.ok) {
    return authenticated;
  }

  const db = getFirebaseAdmin();
  if (!db) {
    return serviceError(500, 'db_unavailable', 'Database not available');
  }

  let role: AppRole | null = authenticated.data.isAdminClaim
    ? 'admin'
    : authenticated.data.claimedRole || null;

  if (!role) {
    let profile;
    try {
      profile = await new UserRepository(db).getById(authenticated.data.userId);
    } catch (error) {
      // Fail closed: without the profile there is no role, so deny with 503.
      if (isDatabaseUnavailableError(error)) {
        return serviceError(503, DATABASE_UNAVAILABLE_CODE, DATABASE_UNAVAILABLE_MESSAGE);
      }
      throw error;
    }
    const profileRole = profile.exists ? parseAppRole(profile.data()?.role) : null;
    // A profile document can only grant the self-service patient role. Doctor,
    // reviewer and admin authority must come from a custom claim set by an
    // administrator (scripts/admin/provision-role.mjs), so a legacy or
    // hand-written profile cannot make someone a clinician.
    role = profileRole === 'patient' ? 'patient' : null;
    if (profileRole && profileRole !== 'patient') {
      return serviceError(403, 'role_not_provisioned', 'This account has not been provisioned for this role. Ask the administrator.');
    }
  }

  if (!role) {
    return serviceError(403, 'role_required', 'A provisioned account role is required');
  }
  if (!roleHasPermission(role, permission)) {
    return serviceError(403, 'forbidden', 'Your account role does not allow this action');
  }

  return serviceOk({
    ...authenticated.data,
    role,
  });
}

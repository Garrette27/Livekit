import { NextRequest } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { UserRepository } from '@/lib/repositories/user-repository';
import { serviceResultToResponse } from '@/lib/services/shared/http';
import { authenticateBearerToken } from '@/lib/services/shared/request-auth';
import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { serviceError, serviceOk } from '@/lib/services/shared/service-result';

/**
 * Checks only the authenticated user's email and returns a boolean, keeping
 * other user profiles and roles out of client-side Firestore queries.
 */
async function handlePOST(req: NextRequest) {
  const auth = await authenticateBearerToken(req);
  if (!auth.ok) {
    return serviceResultToResponse(auth);
  }

  const body = (await req.json()) as { email?: unknown; expectedRole?: unknown };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const expectedRole =
    body.expectedRole === 'doctor' || body.expectedRole === 'patient'
      ? body.expectedRole
      : null;
  if (!email || !expectedRole) {
    return serviceResultToResponse(
      serviceError(400, 'invalid_role_conflict_request', 'Email and expected role are required')
    );
  }
  if (!auth.data.email || auth.data.email.trim().toLowerCase() !== email) {
    return serviceResultToResponse(
      serviceError(403, 'email_forbidden', 'You can only check the authenticated account email')
    );
  }

  const db = getFirebaseAdmin();
  if (!db) {
    return serviceResultToResponse(serviceError(500, 'db_unavailable', 'Database not initialized'));
  }

  const oppositeRole = expectedRole === 'doctor' ? 'patient' : 'doctor';
  const profiles = await new UserRepository(db).findAllByEmail(email);
  const conflict = profiles.find((profile) => (
    profile.id !== auth.data.userId && profile.data()?.role === oppositeRole
  ));

  return serviceResultToResponse(serviceOk({
    hasConflict: Boolean(conflict),
    conflictRole: conflict ? oppositeRole : undefined,
  }));
}

export const POST = withRequestLogging(handlePOST);

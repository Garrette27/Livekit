import { NextRequest, NextResponse } from 'next/server';
import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { authenticateBearerToken } from '@/lib/services/shared/request-auth';
import { serviceResultToResponse } from '@/lib/services/shared/http';
import { getFirebaseAdmin, getFirebaseAdminAuth } from '@/lib/firebase-admin';
import { enforceRateLimit, RateLimitConfigs } from '@/lib/rate-limit';
import {
  administratorLevel,
  decideRoleChange,
  parseSuperAdminEmails,
  presentManagedAccount,
  type ManagedRole,
  type RoleAction,
} from '@/lib/auth/role-administration';

const PRIVILEGED_PROFILE_ROLES = ['doctor', 'admin'];

function superAdmins() {
  return parseSuperAdminEmails(process.env.SUPER_ADMIN_EMAILS);
}

/**
 * GET: the caller's administrator level and the clinician/admin accounts,
 * each with whether its role comes from a claim (provisioned) or only from a
 * legacy profile. POST { email, role, action }: grant or revoke a role.
 * Changes align claims/profile metadata and write a uid-only audit event.
 * Only revocations revoke refresh tokens; grants appear on token refresh.
 */
async function handleGET(req: NextRequest) {
  const caller = await authenticateBearerToken(req);
  if (!caller.ok) return serviceResultToResponse(caller);
  const level = administratorLevel(caller.data, superAdmins());
  if (!level) {
    return NextResponse.json({ success: false, code: 'not_administrator', error: 'Only an administrator can view this page.' }, { status: 403 });
  }
  const db = getFirebaseAdmin();
  const auth = getFirebaseAdminAuth();
  if (!db || !auth) {
    return NextResponse.json({ success: false, error: 'Service unavailable' }, { status: 503 });
  }
  const snapshot = await db.collection('users').where('role', 'in', PRIVILEGED_PROFILE_ROLES).limit(200).get();
  // A clinic administrator sees only their own clinic's accounts.
  const scopedDocs = level === 'super_admin'
    ? snapshot.docs
    : snapshot.docs.filter((doc) => caller.data.clinicId && doc.data().clinicId === caller.data.clinicId);
  let accounts;
  try {
  accounts = await Promise.all(scopedDocs.map(async (doc) => {
    const profile = doc.data() as { email?: string; role?: string; doctorName?: string; clinicId?: string };
    const user = await auth.getUser(doc.id).catch((error) => {
      if (error?.code === 'auth/user-not-found') return null;
      throw error;
    });
    return {
      uid: doc.id,
      ...presentManagedAccount(user, profile, superAdmins()),
    };
  }));
  } catch {
    return NextResponse.json({ success: false, error: 'Could not verify account status. Please retry.' }, { status: 503 });
  }
  return NextResponse.json({ success: true, level, callerUid: caller.data.userId, clinicId: caller.data.clinicId || null, accounts });
}

async function handlePOST(req: NextRequest) {
  const limited = await enforceRateLimit(req, RateLimitConfigs.TOKEN_GENERATION);
  if (limited) return limited;
  const caller = await authenticateBearerToken(req);
  if (!caller.ok) return serviceResultToResponse(caller);

  if (!administratorLevel(caller.data, superAdmins())) {
    return NextResponse.json({ success: false, code: 'not_administrator', error: 'Only an administrator can change roles.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) ?? {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = body.role as ManagedRole;
  const action = body.action as RoleAction;
  if (!email || email.length > 254 || (action !== 'grant' && action !== 'revoke')) {
    return NextResponse.json({ success: false, error: 'Provide an email and action grant or revoke.' }, { status: 400 });
  }

  const db = getFirebaseAdmin();
  const auth = getFirebaseAdminAuth();
  if (!db || !auth) {
    return NextResponse.json({ success: false, error: 'Service unavailable' }, { status: 503 });
  }

  let target;
  try {
    target = await auth.getUserByEmail(email);
  } catch (error) {
    if ((error as { code?: string })?.code !== 'auth/user-not-found') {
      return NextResponse.json({ success: false, error: 'Could not verify the target account. Please retry.' }, { status: 503 });
    }
  }
  if (!target) {
    return NextResponse.json({ success: false, code: 'account_not_found', error: 'No account uses that email. Ask the clinician to sign in once first.' }, { status: 404 });
  }
  const profileRef = db.collection('users').doc(target.uid);
  const profile = await profileRef.get();
  const profileRole = profile.exists ? (profile.data()?.role as string | undefined) : undefined;
  const targetClinicId = (target.customClaims?.clinicId as string | undefined) || (profile.data()?.clinicId as string | undefined) || null;
  const decision = decideRoleChange({
    caller: caller.data,
    superAdminEmails: superAdmins(),
    targetUserId: target.uid,
    role,
    action,
    clinicId: body.clinicId,
    targetClinicId,
    targetIsAdmin: target.customClaims?.admin === true || target.customClaims?.role === 'admin' || profileRole === 'admin',
    targetIsSuperAdmin: administratorLevel({ userId: target.uid, email: target.email, emailVerified: target.emailVerified, isAdminClaim: false }, superAdmins()) === 'super_admin',
  });
  if (!decision.allowed) {
    return NextResponse.json({ success: false, code: decision.code, error: decision.message }, { status: decision.status });
  }
  if (action === 'grant' && profileRole === 'patient') {
    // Separate identities: a patient account keeps its own health history.
    return NextResponse.json({ success: false, code: 'patient_account', error: 'This email belongs to a patient account. Provision a separate clinician account.' }, { status: 409 });
  }

  // Administrative identities are not clinicians. Switching to Doctor is an
  // explicit owner-approved role change, never a side effect of revocation.
  const claims = { ...(target.customClaims || {}) } as Record<string, unknown>;
  const now = new Date();
  const wasAdministrator = claims.admin === true || claims.role === 'admin' || profileRole === 'admin';
  const previousRole = typeof claims.role === 'string' ? claims.role : null;
  if (action === 'grant') {
    claims.role = role;
    claims.clinicId = decision.clinicId;
    if (role === 'admin') claims.admin = true;
    else delete claims.admin;
  } else if (role === 'admin') {
    delete claims.admin;
    if (wasAdministrator) {
      delete claims.role;
      delete claims.clinicId;
    }
  } else {
    delete claims.role;
    delete claims.admin;
    delete claims.clinicId;
  }
  await auth.setCustomUserClaims(target.uid, claims);
  if (action === 'grant') {
    await profileRef.set({ email, role, clinicId: decision.clinicId, provisionedAt: now, ...(profile.exists ? {} : { registeredAt: now }) }, { merge: true });
  } else if ((role === 'doctor' || wasAdministrator) && profileRole && PRIVILEGED_PROFILE_ROLES.includes(profileRole)) {
    // Keep the profile (history stays attributable) but stop the legacy
    // profile-role fallback from honouring it.
    await profileRef.set({ role: 'revoked', revokedRole: profileRole, revokedAt: now }, { merge: true });
  }
  // A grant that switches between administrator and doctor also removes a
  // privilege (admins are never clinical), so it must end the old token too.
  const grantRemovesPrivilege = action === 'grant'
    && ((wasAdministrator && role !== 'admin') || (role === 'admin' && previousRole === 'doctor'));
  if (action === 'revoke' || grantRemovesPrivilege) {
    // Ends existing sessions; protected APIs check revocation on every request,
    // so the old ID token stops working immediately. A grant that only adds
    // access (e.g. a new doctor) does not sign anyone out.
    await auth.revokeRefreshTokens(target.uid);
  }
  await db.collection('adminAuditEvents').add({
    action: `role_${action}`,
    role,
    clinicId: decision.clinicId,
    targetUid: target.uid,
    actorUid: caller.data.userId,
    at: now,
  });

  return NextResponse.json({ success: true, uid: target.uid, role, action, clinicId: decision.clinicId });
}

export const GET = withRequestLogging(handleGET);
export const POST = withRequestLogging(handlePOST);

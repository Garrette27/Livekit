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
 * Every change sets/removes the custom claim, aligns the profile, revokes
 * refresh tokens (the new role applies at next sign-in) and writes an audit
 * event that names uids, never emails.
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
  const accounts = await Promise.all(snapshot.docs.map(async (doc) => {
    const profile = doc.data() as { email?: string; role?: string; doctorName?: string };
    const user = await auth.getUser(doc.id).catch(() => null);
    const claimRole = user?.customClaims?.admin === true ? 'admin' : (user?.customClaims?.role as string | undefined);
    return {
      uid: doc.id,
      email: profile.email || user?.email || null,
      name: profile.doctorName || user?.displayName || null,
      role: profile.role,
      provisioned: claimRole === profile.role,
      disabled: user?.disabled === true,
    };
  }));
  return NextResponse.json({ success: true, level, callerUid: caller.data.userId, accounts });
}

async function handlePOST(req: NextRequest) {
  const limited = await enforceRateLimit(req, RateLimitConfigs.TOKEN_GENERATION);
  if (limited) return limited;
  const caller = await authenticateBearerToken(req);
  if (!caller.ok) return serviceResultToResponse(caller);

  const body = await req.json().catch(() => ({}));
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

  const target = await auth.getUserByEmail(email).catch(() => null);
  if (!target) {
    return NextResponse.json({ success: false, code: 'account_not_found', error: 'No account uses that email. Ask the clinician to sign in once first.' }, { status: 404 });
  }
  const decision = decideRoleChange({ caller: caller.data, superAdminEmails: superAdmins(), targetUserId: target.uid, role, action });
  if (!decision.allowed) {
    return NextResponse.json({ success: false, code: decision.code, error: decision.message }, { status: decision.status });
  }

  const profileRef = db.collection('users').doc(target.uid);
  const profile = await profileRef.get();
  const profileRole = profile.exists ? (profile.data()?.role as string | undefined) : undefined;
  if (action === 'grant' && profileRole === 'patient') {
    // Separate identities: a patient account keeps its own health history.
    return NextResponse.json({ success: false, code: 'patient_account', error: 'This email belongs to a patient account. Provision a separate clinician account.' }, { status: 409 });
  }

  const claims = { ...(target.customClaims || {}) } as Record<string, unknown>;
  if (action === 'grant') {
    claims.role = role;
    if (role === 'admin') claims.admin = true;
  } else {
    delete claims.role;
    delete claims.admin;
  }
  await auth.setCustomUserClaims(target.uid, claims);
  const now = new Date();
  if (action === 'grant') {
    await profileRef.set({ email, role, provisionedAt: now, ...(profile.exists ? {} : { registeredAt: now }) }, { merge: true });
  } else if (profileRole && PRIVILEGED_PROFILE_ROLES.includes(profileRole)) {
    // Keep the profile (history stays attributable) but stop the legacy
    // profile-role fallback from honouring it.
    await profileRef.set({ role: 'revoked', revokedRole: profileRole, revokedAt: now }, { merge: true });
  }
  await auth.revokeRefreshTokens(target.uid);
  await db.collection('adminAuditEvents').add({
    action: `role_${action}`,
    role,
    targetUid: target.uid,
    actorUid: caller.data.userId,
    at: now,
  });

  return NextResponse.json({ success: true, uid: target.uid, role, action });
}

export const GET = withRequestLogging(handleGET);
export const POST = withRequestLogging(handlePOST);

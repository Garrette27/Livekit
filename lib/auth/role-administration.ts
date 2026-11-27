/**
 * Who may grant or revoke clinician roles. Pure: callers supply the verified
 * caller and configuration; the route performs the IO.
 *
 * Pattern: administrator provisioning with claims-based RBAC and a
 * break-glass bootstrap. The first administrator is a "super admin" named by
 * the server-only SUPER_ADMIN_EMAILS variable (provider-verified email,
 * non-anonymous account). Super admins may grant/revoke doctor and admin;
 * admins (custom claim `admin: true`) may grant/revoke doctor only. Nobody may
 * change their own role, so a single account cannot escalate or lock itself out.
 *
 * Tenancy (small-clinic business model): every clinician and administrator
 * belongs to one clinic (`clinicId` claim). A super admin (the platform
 * operator) creates clinic administrators; a clinic administrator manages
 * doctors only inside their own clinic — delegated, tenant-scoped
 * administration. Clinical records stay owned by the doctor who created the
 * invitation; the clinic scope bounds who may administer whom.
 */
export type ManagedRole = 'doctor' | 'admin';
export type RoleAction = 'grant' | 'revoke';

export interface RoleAdministrator {
  userId: string;
  email?: string | null;
  emailVerified: boolean;
  isAdminClaim: boolean;
  /** Clinic named in the caller's claims (clinic administrators). */
  clinicId?: string | null;
}

const CLINIC_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;

/** Lower-case slug such as "henry-cheung-dental"; null when invalid. */
export function normalizeClinicId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return CLINIC_ID_PATTERN.test(slug) ? slug : null;
}

export function parseSuperAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw || '').split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter((email) => email.includes('@'))
  );
}

export function administratorLevel(
  caller: RoleAdministrator,
  superAdminEmails: Set<string>
): 'super_admin' | 'admin' | null {
  const email = caller.email?.trim().toLowerCase();
  if (email && caller.emailVerified && superAdminEmails.has(email)) {
    return 'super_admin';
  }
  return caller.isAdminClaim ? 'admin' : null;
}

/** Resolve navigation from verified server identity; this projection grants no permissions. */
export function resolveWorkspaceAccess(
  caller: RoleAdministrator & { claimedRole?: string },
  superAdminEmails: Set<string>,
  legacyProfileRole?: string
) {
  const level = administratorLevel(caller, superAdminEmails);
  const role = caller.claimedRole || legacyProfileRole;
  const doctorAccess = caller.isAdminClaim || role === 'doctor' || role === 'admin';
  return {
    administratorLevel: level,
    clinicId: normalizeClinicId(caller.clinicId),
    doctorAccess,
    homePath: level ? '/admin' : doctorAccess ? '/doctor/invitations' : role === 'patient' ? '/patient/dashboard' : null,
  };
}

/** Display authority separately from profile history; only Auth can establish bootstrap identity. */
export function presentManagedAccount(
  user: { uid: string; email?: string; emailVerified?: boolean; displayName?: string; disabled?: boolean; customClaims?: Record<string, unknown> } | null,
  profile: { email?: string; role?: string; doctorName?: string; clinicId?: string },
  superAdminEmails: Set<string>
) {
  const claims = user?.customClaims || {};
  const bootstrap = Boolean(user && administratorLevel({ userId: user.uid, email: user.email,
    emailVerified: user.emailVerified === true, isAdminClaim: false }, superAdminEmails) === 'super_admin');
  const administrator = claims.admin === true;
  const provisioned = bootstrap || administrator || (typeof claims.role === 'string' && claims.role === profile.role);
  const authority = !user ? 'account_missing' : user.disabled ? 'disabled' : bootstrap ? 'server_bootstrap' : provisioned ? 'custom_claims' : 'legacy_profile';
  return {
    email: user?.email || profile.email || null,
    name: profile.doctorName || user?.displayName || null,
    role: bootstrap ? 'super_admin' : administrator ? 'admin' : profile.role || claims.role || 'unassigned',
    clinicId: normalizeClinicId(claims.clinicId) || normalizeClinicId(profile.clinicId),
    provisioned,
    disabled: user?.disabled === true,
    authority,
    canManage: Boolean(user && !bootstrap),
  };
}

export function decideRoleChange(input: {
  caller: RoleAdministrator;
  superAdminEmails: Set<string>;
  targetUserId: string;
  role: ManagedRole;
  action: RoleAction;
  /** Clinic requested for a grant. */
  clinicId?: string | null;
  /** Clinic the target already belongs to (from claims or profile). */
  targetClinicId?: string | null;
  /** Target currently holds the administrator claim. */
  targetIsAdmin?: boolean;
  /** Server-derived bootstrap status, never supplied by the browser. */
  targetIsSuperAdmin?: boolean;
}):
  | { allowed: true; clinicId: string | null }
  | { allowed: false; status: number; code: string; message: string } {
  const level = administratorLevel(input.caller, input.superAdminEmails);
  if (!level) {
    return { allowed: false, status: 403, code: 'not_administrator', message: 'Only an administrator can change roles.' };
  }
  if (input.targetIsSuperAdmin) {
    return { allowed: false, status: 409, code: 'bootstrap_managed', message: 'This platform administrator is managed by server configuration, not clinician role commands.' };
  }
  if (input.role !== 'doctor' && input.role !== 'admin') {
    return { allowed: false, status: 400, code: 'invalid_role', message: 'Only doctor or admin roles are managed here.' };
  }
  if (input.role === 'admin' && level !== 'super_admin') {
    return { allowed: false, status: 403, code: 'super_admin_required', message: 'Only a super admin can change administrator roles.' };
  }
  if (input.targetUserId === input.caller.userId) {
    return { allowed: false, status: 409, code: 'self_change', message: 'You cannot change your own role.' };
  }
  if (input.targetIsAdmin && level !== 'super_admin') {
    return { allowed: false, status: 403, code: 'super_admin_required', message: 'Only a super admin can change an administrator account.' };
  }

  if (level === 'admin') {
    const ownClinic = normalizeClinicId(input.caller.clinicId);
    if (!ownClinic) {
      return { allowed: false, status: 403, code: 'clinic_required', message: 'Your administrator account is not assigned to a clinic.' };
    }
    const requested = input.action === 'grant' ? normalizeClinicId(input.clinicId) ?? ownClinic : ownClinic;
    const target = normalizeClinicId(input.targetClinicId);
    if (requested !== ownClinic || (target && target !== ownClinic) || (input.action === 'revoke' && target !== ownClinic)) {
      return { allowed: false, status: 403, code: 'other_clinic', message: 'You can only manage accounts in your own clinic.' };
    }
    return { allowed: true, clinicId: ownClinic };
  }

  if (input.action === 'grant') {
    const clinicId = normalizeClinicId(input.clinicId);
    if (!clinicId) {
      return { allowed: false, status: 400, code: 'clinic_required', message: 'Choose the clinic this account belongs to (e.g. henry-cheung-dental).' };
    }
    return { allowed: true, clinicId };
  }
  return { allowed: true, clinicId: normalizeClinicId(input.targetClinicId) };
}

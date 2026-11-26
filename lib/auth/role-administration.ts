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
 */
export type ManagedRole = 'doctor' | 'admin';
export type RoleAction = 'grant' | 'revoke';

export interface RoleAdministrator {
  userId: string;
  email?: string | null;
  emailVerified: boolean;
  isAdminClaim: boolean;
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

export function decideRoleChange(input: {
  caller: RoleAdministrator;
  superAdminEmails: Set<string>;
  targetUserId: string;
  role: ManagedRole;
  action: RoleAction;
}): { allowed: true } | { allowed: false; status: number; code: string; message: string } {
  const level = administratorLevel(input.caller, input.superAdminEmails);
  if (!level) {
    return { allowed: false, status: 403, code: 'not_administrator', message: 'Only an administrator can change roles.' };
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
  return { allowed: true };
}

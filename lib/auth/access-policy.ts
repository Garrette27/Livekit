/**
 * Server-enforced application roles. `faculty_reviewer` is intentionally
 * read-only: it reserves a safe thesis-review role without granting access to
 * patient data until an explicit assignment workflow is implemented.
 */
export const APP_ROLES = [
  'doctor',
  'patient',
  'faculty_reviewer',
  'admin',
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type AppPermission =
  | 'consultation:link-own'
  | 'consultation:read-own'
  | 'consultation:review-assigned'
  | 'invitation:manage'
  | 'room:join-doctor'
  | 'room:join-patient'
  | 'summary:delete-own'
  | 'summary:manage-own'
  | 'waiting-room:manage';

const ROLE_PERMISSIONS: Record<AppRole, ReadonlySet<AppPermission>> = {
  doctor: new Set([
    'consultation:read-own',
    'invitation:manage',
    'room:join-doctor',
    'summary:delete-own',
    'summary:manage-own',
    'waiting-room:manage',
  ]),
  patient: new Set([
    'consultation:link-own',
    'consultation:read-own',
    'room:join-patient',
    'summary:delete-own',
  ]),
  faculty_reviewer: new Set(['consultation:review-assigned']),
  admin: new Set([
    'consultation:link-own',
    'consultation:read-own',
    'consultation:review-assigned',
    'invitation:manage',
    'room:join-doctor',
    'room:join-patient',
    'summary:delete-own',
    'summary:manage-own',
    'waiting-room:manage',
  ]),
};

/** Converts untrusted profile/claim data into a known role or null. */
export function parseAppRole(value: unknown): AppRole | null {
  return typeof value === 'string' && APP_ROLES.includes(value as AppRole)
    ? (value as AppRole)
    : null;
}

/** Answers authorization from the single role-to-permission policy table. */
export function roleHasPermission(role: AppRole, permission: AppPermission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

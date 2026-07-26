import type { Firestore } from 'firebase/firestore';
import { authenticatedFetch } from '@/lib/auth/authenticated-fetch';

export type AccountRole = 'doctor' | 'patient';

interface RoleConflictCheckInput {
  db: Firestore;
  email: string;
  expectedRole: AccountRole;
  currentUserId?: string | null;
}

interface RoleConflictCheckResult {
  hasConflict: boolean;
  conflictRole?: AccountRole;
  conflictUserId?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function oppositeRole(role: AccountRole): AccountRole {
  return role === 'doctor' ? 'patient' : 'doctor';
}

/**
 * Verifies role uniqueness without granting browsers collection-wide access to
 * user profiles. The server binds the check to the authenticated token email.
 */
export async function checkRoleConflictByEmail({
  email,
  expectedRole,
}: RoleConflictCheckInput): Promise<RoleConflictCheckResult> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { hasConflict: false };
  }

  const response = await authenticatedFetch('/api/user/role-conflict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, expectedRole }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Could not verify account role');
  }

  return {
    hasConflict: data.hasConflict === true,
    conflictRole: data.hasConflict === true ? oppositeRole(expectedRole) : undefined,
  };
}

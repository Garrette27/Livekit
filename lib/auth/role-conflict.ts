import { Firestore, collection, getDocs, query, where } from 'firebase/firestore';

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
 * Verify that an email is not already used by a profile in the opposite role.
 * This keeps role ownership deterministic per email across doctor/patient flows.
 */
export async function checkRoleConflictByEmail({
  db,
  email,
  expectedRole,
  currentUserId,
}: RoleConflictCheckInput): Promise<RoleConflictCheckResult> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { hasConflict: false };
  }

  const conflictRole = oppositeRole(expectedRole);
  const emailQuery = query(collection(db, 'users'), where('email', '==', normalizedEmail));
  const snapshot = await getDocs(emailQuery);

  const conflictingDoc = snapshot.docs.find((snapshotDoc) => {
    if (currentUserId && snapshotDoc.id === currentUserId) {
      return false;
    }

    const profile = snapshotDoc.data() as { role?: AccountRole };
    return profile.role === conflictRole;
  });

  if (!conflictingDoc) {
    return { hasConflict: false };
  }

  return {
    hasConflict: true,
    conflictRole,
    conflictUserId: conflictingDoc.id,
  };
}

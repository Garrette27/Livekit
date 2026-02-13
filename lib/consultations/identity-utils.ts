const RESERVED_USER_IDS = new Set(['anonymous', 'unknown']);

export function isKnownUserId(userId: string | null | undefined): userId is string {
  return Boolean(userId && !RESERVED_USER_IDS.has(userId));
}

export function choosePatientUserId(
  candidateUserId: string | null | undefined,
  existingUserId: string | null | undefined
): string {
  if (!isKnownUserId(candidateUserId) && isKnownUserId(existingUserId)) {
    return existingUserId;
  }

  return candidateUserId || 'anonymous';
}

export function buildVisibleUserIds(
  doctorUserId: string | null | undefined,
  patientUserId: string | null | undefined,
  existingVisibleToUsers: string[] = []
): string[] {
  const merged = [...existingVisibleToUsers, doctorUserId || null, patientUserId || null];
  return [...new Set(merged.filter((userId): userId is string => isKnownUserId(userId)))];
}

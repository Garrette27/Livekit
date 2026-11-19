const RESERVED_USER_IDS = new Set(['anonymous', 'unknown']);

export function isKnownUserId(userId: string | null | undefined): userId is string {
  return Boolean(userId && !RESERVED_USER_IDS.has(userId));
}

/**
 * Legacy metadata can supply a missing patient UID. Conflicting recorded UIDs
 * fail closed; emails and caller-supplied encounter IDs never establish ownership.
 */
export function hasRecordedPatientIdentity(record: Record<string, unknown>, patientUserId: string): boolean {
  const metadata = (record.metadata as Record<string, unknown> | undefined) || {};
  const patientIds = [record.patientUserId, metadata.patientUserId].filter(
    (value): value is string => typeof value === 'string' && isKnownUserId(value)
  );
  return patientIds.length > 0 && patientIds.every((id) => id === patientUserId);
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

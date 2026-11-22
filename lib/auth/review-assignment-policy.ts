export type ReviewAssignmentStatus = 'active' | 'revoked' | 'completed';

export interface ReviewAssignment {
  reviewerUserId: string;
  consultationSessionId: string;
  purpose: string;
  grantedBy: string;
  grantedAt: Date;
  expiresAt: Date;
  status: ReviewAssignmentStatus;
}

/**
 * Decide whether a future faculty reviewer may access one exact consultation.
 *
 * This pure backend policy is intentionally not connected to a route or UI.
 * A future review endpoint must require both the role permission and this
 * assignment decision; the reserved role alone never grants collection access.
 * Malformed persisted assignments fail closed instead of throwing or matching
 * empty identities. This policy accepts normalized Date values, not raw SDK timestamps.
 */
export function hasActiveReviewAssignment(
  assignment: ReviewAssignment | null | undefined,
  input: {
    reviewerUserId: string;
    consultationSessionId: string;
    now?: Date;
  }
): boolean {
  const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
  const isValidDate = (value: unknown): value is Date => value instanceof Date && Number.isFinite(value.getTime());
  const now = input.now || new Date();
  if (
    !assignment || assignment.status !== 'active'
    || !hasText(input.reviewerUserId) || !hasText(input.consultationSessionId)
    || !hasText(assignment.reviewerUserId) || !hasText(assignment.consultationSessionId)
    || !hasText(assignment.purpose) || !hasText(assignment.grantedBy)
    || !isValidDate(assignment.grantedAt) || !isValidDate(assignment.expiresAt)
    || !isValidDate(now)
  ) {
    return false;
  }

  return (
    assignment.reviewerUserId === input.reviewerUserId &&
    assignment.consultationSessionId === input.consultationSessionId &&
    assignment.grantedAt.getTime() <= now.getTime() &&
    assignment.expiresAt.getTime() > now.getTime()
  );
}

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
 */
export function hasActiveReviewAssignment(
  assignment: ReviewAssignment | null | undefined,
  input: {
    reviewerUserId: string;
    consultationSessionId: string;
    now?: Date;
  }
): boolean {
  if (!assignment || assignment.status !== 'active') {
    return false;
  }

  const now = input.now || new Date();
  return (
    assignment.reviewerUserId === input.reviewerUserId &&
    assignment.consultationSessionId === input.consultationSessionId &&
    assignment.purpose.trim().length > 0 &&
    assignment.grantedBy.trim().length > 0 &&
    assignment.grantedAt.getTime() <= now.getTime() &&
    assignment.expiresAt.getTime() > now.getTime()
  );
}

/**
 * Who may skip the waiting room.
 *
 * An invitation link is a capability: holding it proves nothing about who is
 * holding it. So admission is decided from how strongly the visitor's identity
 * is established, not from an email address they can type. This mirrors the
 * assurance-level split in NIST SP 800-63 (proofing is separate from
 * authentication) and the guest/host model used by mainstream video products:
 * a verified, expected participant joins directly, and everyone else — guests
 * included — is a decision the clinician makes in the waiting room.
 *
 * The hybrid this supports: anonymous patients are never blocked, they are
 * queued. Only a signed-in account with a verified email that the doctor
 * allowlisted bypasses the queue.
 */

/** How well the system knows who is entering, weakest to strongest. */
export type IdentityAssurance =
  | 'anonymous'
  | 'self-declared'
  | 'authenticated'
  | 'verified';

export interface VisitorIdentity {
  /** Firebase uid when the visitor has any account, including an anonymous one. */
  userId?: string | null;
  /** Email from the verified auth token, not from the request body. */
  authenticatedEmail?: string | null;
  /** Firebase `email_verified` claim. */
  emailVerified?: boolean;
  /** True for Firebase anonymous-auth sessions. */
  isAnonymousAccount?: boolean;
  /** Email the visitor typed, or that the signed invitation carries. */
  declaredEmail?: string | null;
}

export type AdmissionDecision =
  | { admit: 'directly'; assurance: IdentityAssurance; reason: string }
  | { admit: 'waiting-room'; assurance: IdentityAssurance; reason: string };

function normalizeEmail(email?: string | null): string | null {
  const normalized = email?.toLowerCase().trim();
  return normalized ? normalized : null;
}

/**
 * The strongest claim the system can make about this visitor. `verified`
 * requires a signed-in, non-anonymous account whose email the identity provider
 * confirmed — the only tier where an address is evidence of ownership.
 */
export function resolveIdentityAssurance(visitor: VisitorIdentity): IdentityAssurance {
  const authenticatedEmail = normalizeEmail(visitor.authenticatedEmail);

  if (authenticatedEmail && visitor.emailVerified && !visitor.isAnonymousAccount) {
    return 'verified';
  }
  if (authenticatedEmail && !visitor.isAnonymousAccount) {
    return 'authenticated';
  }
  if (normalizeEmail(visitor.declaredEmail)) {
    return 'self-declared';
  }
  return 'anonymous';
}

/**
 * Decides whether this visitor joins the consultation directly or waits.
 *
 * Fails closed: anything short of a verified allowlisted identity goes to the
 * waiting room, where the doctor can still admit them. Being queued is not a
 * rejection, so an anonymous patient loses nothing but a click of the doctor's.
 */
export function decideAdmission(input: {
  visitor: VisitorIdentity;
  /** Emails the doctor marked as allowed to skip the waiting room. */
  allowlist: string[];
}): AdmissionDecision {
  const assurance = resolveIdentityAssurance(input.visitor);
  const allowlist = input.allowlist.map((email) => normalizeEmail(email)).filter((email): email is string => Boolean(email));

  if (allowlist.length === 0) {
    return {
      admit: 'waiting-room',
      assurance,
      reason: 'This invitation admits every patient through the waiting room',
    };
  }

  if (assurance !== 'verified') {
    return {
      admit: 'waiting-room',
      assurance,
      reason:
        assurance === 'anonymous'
          ? 'Visitor has not identified themselves'
          : 'Visitor has not signed in with a verified email, so their identity is unconfirmed',
    };
  }

  const authenticatedEmail = normalizeEmail(input.visitor.authenticatedEmail) as string;
  if (!allowlist.includes(authenticatedEmail)) {
    return {
      admit: 'waiting-room',
      assurance,
      reason: 'Verified email is not on this invitation’s skip-the-queue list',
    };
  }

  return {
    admit: 'directly',
    assurance,
    reason: 'Verified email matches this invitation’s skip-the-queue list',
  };
}

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
 * Signals worth interrupting a patient for.
 *
 * Browser and device fingerprints change whenever someone opens a private
 * window, updates their browser, or picks up a different phone — they fire
 * constantly on honest traffic while an attacker can match them at will, so
 * gating on them costs far more than they protect. They are still recorded and
 * shown to the doctor as context. A country change is rare enough to be worth
 * a human check.
 */
const STEP_UP_SIGNALS = new Set(['wrong_country']);

function requiresStepUp(riskSignals?: string[]): string[] {
  return (riskSignals || []).filter((signal) => STEP_UP_SIGNALS.has(signal));
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
  /** Whether the invitation has any configured direct-admission identities. */
  allowlistConfigured: boolean;
  /** Server-side result of matching the provider-verified email to the keyed allowlist. */
  verifiedEmailAllowed: boolean;
  /**
   * Unusual-context signals such as an unrecognised device or a different
   * country. These lower confidence but never deny access on their own — see
   * the note on step-up below.
   */
  riskSignals?: string[];
}): AdmissionDecision {
  const assurance = resolveIdentityAssurance(input.visitor);

  // A location that does not match the last visit is a case for a human check,
  // not a closed door: sending the patient to the waiting room is the step-up.
  const stepUpSignals = requiresStepUp(input.riskSignals);
  if (stepUpSignals.length > 0) {
    return {
      admit: 'waiting-room',
      assurance,
      reason: `Unrecognised sign-in context (${stepUpSignals.join(', ')}), so the doctor confirms this patient`,
    };
  }
  if (!input.allowlistConfigured) {
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

  if (!input.verifiedEmailAllowed) {
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

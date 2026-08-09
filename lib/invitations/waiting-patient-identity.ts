interface BuildWaitingPatientIdentityInput {
  /** Email the visitor typed in this session. Self-asserted, so weakest source. */
  explicitUserEmail?: string;
  /** Email on the registered `users` profile the server resolved. Strongest source. */
  profileEmail?: string;
  /** Email carried by the server-signed invitation token. */
  invitationEmail?: string;
  /** Registered user document id, when the visitor matches a known account. */
  userDocId?: string;
}

/**
 * How the visitor's email was established, strongest first. The doctor's queue
 * shows this so "who is waiting" is answered with its provenance rather than
 * an unqualified address.
 */
export type PatientIdentitySource = 'registered-profile' | 'invitation-token' | 'self-declared' | 'unidentified';

interface WaitingPatientIdentity {
  patientId: string;
  patientName: string;
  patientEmail?: string;
  isAnonymous: boolean;
  identitySource: PatientIdentitySource;
}

function normalizeEmail(email?: string): string | undefined {
  return email ? email.toLowerCase().trim() : undefined;
}

/**
 * Resolves who is entering the waiting room from the strongest identity the
 * server can establish.
 *
 * A returning patient often reopens the invitation link without retyping their
 * address, so an identity built only from what they typed this session would
 * discard the account and token the server already verified — leaving the
 * doctor with an anonymous entry and no way for the allowlist to match.
 */
export function buildWaitingPatientIdentity({
  explicitUserEmail,
  profileEmail,
  invitationEmail,
  userDocId,
}: BuildWaitingPatientIdentityInput): WaitingPatientIdentity {
  const registeredEmail = normalizeEmail(profileEmail);
  const tokenEmail = normalizeEmail(invitationEmail);
  const declaredEmail = normalizeEmail(explicitUserEmail);

  const resolvedEmail = registeredEmail || tokenEmail || declaredEmail;
  const identitySource: PatientIdentitySource = registeredEmail
    ? 'registered-profile'
    : tokenEmail
      ? 'invitation-token'
      : declaredEmail
        ? 'self-declared'
        : 'unidentified';

  if (!resolvedEmail) {
    return {
      patientId: `anonymous_${Date.now()}`,
      patientName: 'Anonymous Patient',
      isAnonymous: true,
      identitySource,
    };
  }

  return {
    patientId: userDocId || `anonymous_${Date.now()}`,
    patientName: resolvedEmail,
    patientEmail: resolvedEmail,
    // Anonymous means "no registered account behind this entry", which is what
    // decides whether the consultation can later be linked to a patient record.
    isAnonymous: !userDocId,
    identitySource,
  };
}

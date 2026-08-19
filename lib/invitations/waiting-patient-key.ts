import { hashSecuritySignal } from '../security/security-signal';

/**
 * The identifier for a patient's place in one invitation's queue.
 *
 * A queue entry describes a person waiting for a specific invitation, so that
 * pair is its natural key. Deriving the id from the pair means a patient who
 * reloads, reconnects, or returns later lands on the entry they already have
 * instead of creating another one beside it — previously every visit minted a
 * fresh document, and a single patient accumulated eight rows for one
 * invitation.
 *
 * The discriminator is a keyed hash rather than the address itself, so a
 * document id never carries a patient's email.
 */
export function resolveWaitingPatientId(input: {
  invitationId: string;
  /** Verified or invitation-supplied address, when the patient has one. */
  patientEmail?: string | null;
  /** Registered account id, when the patient has one. */
  patientId?: string | null;
  /** Keyed hashes already computed for this request. */
  networkHash: string;
  userAgentHash: string;
}): string {
  const email = input.patientEmail?.trim().toLowerCase();
  if (email) {
    return `waiting_${input.invitationId}_${hashSecuritySignal('email', email).slice(0, 24)}`;
  }

  const accountId = input.patientId?.trim();
  if (accountId && accountId !== 'anonymous' && !accountId.startsWith('anonymous_')) {
    return `waiting_${input.invitationId}_${hashSecuritySignal('account', accountId).slice(0, 24)}`;
  }

  // An unidentified visitor has no durable handle, so the best available
  // approximation is the device and network they arrived from. It is stable
  // enough to collapse a reload into one entry, and deliberately not treated
  // as identity anywhere else.
  const deviceKey = `${input.networkHash}:${input.userAgentHash}`;
  return `waiting_${input.invitationId}_anon_${hashSecuritySignal('device', deviceKey).slice(0, 24)}`;
}

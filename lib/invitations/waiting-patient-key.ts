import { hashSecuritySignal } from '../security/security-signal';

/**
 * The identifier for a visitor's place in one invitation's queue.
 *
 * The id is stable for the same principal on the same invitation, so a reload
 * or reconnect lands on the entry the visitor already has instead of minting
 * another one. Which visit that entry currently represents is tracked
 * separately (WaitingPatient.currentVisitId).
 *
 * The key is derived only from something the visitor cannot simply type:
 * - a Firebase account uid verified by the server (anonymous or not), or
 * - for a visitor with no Firebase session at all, keyed hashes of their
 *   network and browser — a correlation signal that collapses reloads, never
 *   treated as identity anywhere else.
 *
 * An email address is deliberately NOT part of the key. A typed email, or the
 * email inside a forwardable invitation link, would let a second visitor
 * land on (and inherit the admission of) another person's entry.
 */
export function resolveWaitingPatientId(input: {
  invitationId: string;
  /** Server-verified Firebase uid of the caller, when signed in. */
  principalId?: string | null;
  /** Keyed hashes already computed for this request. */
  networkHash: string;
  userAgentHash: string;
  /** Keyed hash of a per-tab browser id, when the page sent one. */
  browserSessionHash?: string;
}): string {
  const principalId = input.principalId?.trim();
  if (principalId) {
    return `waiting_${input.invitationId}_${hashSecuritySignal('account', principalId).slice(0, 24)}`;
  }

  // A per-tab id keeps two guests on one network and browser apart; without
  // it (older pages) the network and browser hashes alone are used.
  const deviceKey = input.browserSessionHash
    ? `${input.networkHash}:${input.userAgentHash}:${input.browserSessionHash}`
    : `${input.networkHash}:${input.userAgentHash}`;
  return `waiting_${input.invitationId}_anon_${hashSecuritySignal('device', deviceKey).slice(0, 24)}`;
}

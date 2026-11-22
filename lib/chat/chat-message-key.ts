import { createHash } from 'node:crypto';

/** Longest chat message the server stores; long pastes belong in notes. */
export const MAX_CHAT_MESSAGE_LENGTH = 4000;

const SAFE_DOCUMENT_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Turns a client-supplied chat idempotency key into a Firestore document id.
 *
 * LiveKit message ids are already safe and are used unchanged, so existing
 * documents keep their ids. The browser's fallback key is
 * `<sender>:<timestamp>:<text>`, which can contain `/` (an invalid path
 * segment, e.g. "take 1/2 tablet") or exceed Firestore's id limit. Such keys
 * map to a stable SHA-256 digest, so retries of the same message still
 * deduplicate and no message text ends up in a document path.
 */
export function toChatMessageDocumentId(clientKey: string): string {
  if (SAFE_DOCUMENT_ID.test(clientKey)) {
    return clientKey;
  }
  return `k_${createHash('sha256').update(clientKey).digest('hex').slice(0, 40)}`;
}

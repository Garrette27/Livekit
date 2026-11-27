import { createHmac } from 'node:crypto';
import { verifyLiveKitRoomToken } from '@/lib/invitations/token-utils';

/**
 * End-to-end media encryption keys for LiveKit rooms (server side).
 *
 * Each consultation room gets one shared AES key that browsers use to encrypt
 * every audio/video frame and data-channel message *before* it leaves the
 * device, so LiveKit's media servers forward only ciphertext. The key is
 * derived on demand as HMAC-SHA256(LIVEKIT_E2EE_SECRET, label + roomName):
 * nothing is stored, every participant of a room derives the same key, and
 * the secret is deliberately separate from LIVEKIT_API_SECRET, which the
 * provider also holds.
 *
 * The key is released only to a caller presenting a valid consultation
 * credential for that room (canPublish + canSubscribe). Waiting-room
 * credentials never receive it, matching their "no media" grant.
 *
 * Boundary, stated honestly: our application server can derive the key, so
 * this hides media from the video provider, not from the clinic's own server
 * (which never receives media anyway). Rooms reused by one invitation share a
 * key across its encounters.
 */

const KEY_LABEL = 'teleconsole-livekit-e2ee-v1:';
const MIN_SECRET_LENGTH = 32;

export type MediaKeyResult =
  | { status: 200; body: { success: true; enabled: false } }
  | { status: 200; body: { success: true; enabled: true; key: string } }
  | { status: 401 | 403; body: { success: false; error: string } };

/** Returns the configured secret, or null when E2EE is not configured. */
function readSecret(): string | null {
  const secret = process.env.LIVEKIT_E2EE_SECRET?.trim();
  if (!secret) return null;
  if (secret.length < MIN_SECRET_LENGTH) {
    // A short secret would make keys guessable; refuse rather than weaken.
    throw new Error(`LIVEKIT_E2EE_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  return secret;
}

/** Deterministic base64url key for one room; same input, same key, on every server instance. */
export function deriveRoomMediaKey(roomName: string, secret: string): string {
  return createHmac('sha256', secret).update(KEY_LABEL + roomName).digest('base64url');
}

/**
 * Exchanges a LiveKit consultation credential for its room's media key.
 * `enabled: false` means the deployment runs transport encryption only and
 * every participant must join without E2EE (all callers get the same answer).
 */
export function issueRoomMediaKey(accessToken: string | undefined): MediaKeyResult {
  if (!accessToken) {
    return { status: 401, body: { success: false, error: 'A room credential is required.' } };
  }
  let credential;
  try {
    credential = verifyLiveKitRoomToken(accessToken);
  } catch {
    return { status: 401, body: { success: false, error: 'The room credential is invalid or expired.' } };
  }
  if (!credential.canExchangeMedia || credential.roomName.endsWith('-waiting')) {
    return { status: 403, body: { success: false, error: 'This credential cannot join consultation media.' } };
  }
  const secret = readSecret();
  if (!secret) {
    return { status: 200, body: { success: true, enabled: false } };
  }
  return { status: 200, body: { success: true, enabled: true, key: deriveRoomMediaKey(credential.roomName, secret) } };
}

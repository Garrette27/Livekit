import { createHmac } from 'node:crypto';

const SECURITY_SIGNAL_KEY_CONTEXT = 'livekit/security-signal-hmac/v1';

/**
 * Return a key used only for privacy-preserving request correlation. A
 * dedicated key is preferred so it can be rotated independently. Deployments
 * created before that key existed derive a domain-separated subkey from the
 * already-required LiveKit signing secret, keeping invitation access available
 * without reusing the signing key as the correlation key itself.
 */
function resolveSecuritySignalKey(): string | Buffer {
  const configuredSecret =
    process.env.SECURITY_SIGNAL_HASH_SECRET ||
    process.env.INVITATION_TOKEN_SECRET;
  if (configuredSecret) {
    return configuredSecret;
  }

  const liveKitSecret = process.env.LIVEKIT_API_SECRET;
  if (liveKitSecret) {
    return createHmac('sha256', liveKitSecret)
      .update(SECURITY_SIGNAL_KEY_CONTEXT)
      .digest();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SECURITY_SIGNAL_HASH_SECRET or LIVEKIT_API_SECRET is required in production'
    );
  }

  return 'livekit-local-signal-hash';
}

/**
 * Convert an ephemeral request signal into a keyed correlation value. Callers
 * can compare abuse/reuse events without persisting the original network or
 * browser value. The raw signal never leaves this module.
 */
/**
 * The kind of signal being hashed. It is mixed into the digest so the same
 * value under two kinds never collides — an email and an account id that
 * happen to match still produce different correlation values.
 */
export type SecuritySignalKind = 'ip' | 'user-agent' | 'email' | 'account' | 'device';

export function hashSecuritySignal(label: SecuritySignalKind, value: string): string {
  return createHmac('sha256', resolveSecuritySignalKey())
    .update(`${label}:${value}`)
    .digest('hex');
}

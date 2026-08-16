import { createHmac } from 'node:crypto';

/**
 * Convert an ephemeral request signal into a keyed correlation value. Callers
 * can compare abuse/reuse events without persisting the original network or
 * browser value; production deployments must set SECURITY_SIGNAL_HASH_SECRET.
 */
export function hashSecuritySignal(label: 'ip' | 'user-agent', value: string): string {
  const configuredSecret =
    process.env.SECURITY_SIGNAL_HASH_SECRET ||
    process.env.INVITATION_TOKEN_SECRET;
  if (!configuredSecret && process.env.NODE_ENV === 'production') {
    throw new Error('SECURITY_SIGNAL_HASH_SECRET is required in production');
  }

  const secret = configuredSecret || 'livekit-local-signal-hash';
  return createHmac('sha256', secret).update(`${label}:${value}`).digest('hex');
}

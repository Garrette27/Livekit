/**
 * Presentation rules for the invitation list.
 *
 * A doctor managing invitations asks "is this link still usable, and for how
 * much longer" — not "what is the ISO timestamp of its expiry". These helpers
 * answer that question in one place so the list stays scannable.
 */

export type InvitationStatus = 'active' | 'expired' | 'revoked' | 'used';

export interface InvitationStatusPresentation {
  label: string;
  color: string;
  background: string;
}

const STATUS_PRESENTATION: Record<InvitationStatus, InvitationStatusPresentation> = {
  active: { label: 'Active', color: '#065f46', background: '#d1fae5' },
  expired: { label: 'Expired', color: '#6b7280', background: '#f3f4f6' },
  revoked: { label: 'Revoked', color: '#b91c1c', background: '#fee2e2' },
  used: { label: 'Used', color: '#1d4ed8', background: '#dbeafe' },
};

export function resolveInvitationStatusPresentation(status: string): InvitationStatusPresentation {
  return STATUS_PRESENTATION[status as InvitationStatus] || STATUS_PRESENTATION.expired;
}

/**
 * How long an invitation remains usable, phrased for a person deciding whether
 * to send it now ("Expires in 3 hours") or reissue it ("Expired 2 days ago").
 * Returns null when the expiry is unknown.
 */
export function formatExpiryCountdown(expiresAt: Date | null, now: Date = new Date()): string | null {
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    return null;
  }

  const millisecondsRemaining = expiresAt.getTime() - now.getTime();
  const isPast = millisecondsRemaining < 0;
  const minutes = Math.round(Math.abs(millisecondsRemaining) / 60_000);

  const amount =
    minutes < 60
      ? `${Math.max(1, minutes)} minute${minutes === 1 ? '' : 's'}`
      : minutes < 1440
        ? `${Math.round(minutes / 60)} hour${Math.round(minutes / 60) === 1 ? '' : 's'}`
        : `${Math.round(minutes / 1440)} day${Math.round(minutes / 1440) === 1 ? '' : 's'}`;

  return isPast ? `Expired ${amount} ago` : `Expires in ${amount}`;
}

/** Compact "3 of 10 patients" style usage text, or null when not applicable. */
export function formatWaitingRoomOccupancy(
  waitingCount: number | undefined,
  maxPatients: number | undefined
): string | null {
  if (typeof waitingCount !== 'number') {
    return null;
  }
  return `${waitingCount} of ${maxPatients || 10} waiting`;
}

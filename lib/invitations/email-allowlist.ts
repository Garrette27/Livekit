import type { Invitation } from '../types';
import { hashSecuritySignal } from '@/lib/security/security-signal';

function normalizeEmail(email?: string): string | null {
  if (!email) {
    return null;
  }

  const normalized = email.toLowerCase().trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Resolve invitation-level allowlist in one place.
 * Current production field is `emailAllowed`, while `metadata.constraints.emails`
 * is reserved for future multi-email support.
 */
export function getInvitationEmailAllowlist(invitation: Invitation): string[] {
  const list: string[] = [];
  const singleEmail = normalizeEmail(invitation.emailAllowed);
  if (singleEmail) {
    list.push(singleEmail);
  }

  const metadataEmail = normalizeEmail(invitation.metadata?.constraints?.email);
  if (metadataEmail) {
    list.push(metadataEmail);
  }

  const metadataEmails = invitation.metadata?.constraints?.emails;
  if (Array.isArray(metadataEmails)) {
    for (const rawEmail of metadataEmails) {
      const normalized = normalizeEmail(rawEmail);
      if (normalized) {
        list.push(normalized);
      }
    }
  }

  return Array.from(new Set(list));
}

function getInvitationEmailHashes(invitation: Invitation): string[] {
  const hashes = invitation.metadata?.constraints?.emailHashes;
  if (!Array.isArray(hashes)) {
    return [];
  }

  return Array.from(
    new Set(
      hashes.filter((value): value is string =>
        typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
      )
    )
  );
}

/** Number of configured direct-admission identities without exposing them. */
export function getInvitationEmailAllowlistCount(invitation: Invitation): number {
  const storedCount = invitation.metadata?.constraints?.allowlistCount;
  if (typeof storedCount === 'number' && Number.isFinite(storedCount) && storedCount >= 0) {
    return Math.floor(storedCount);
  }

  const hashes = getInvitationEmailHashes(invitation);
  return hashes.length > 0 ? hashes.length : getInvitationEmailAllowlist(invitation).length;
}

export function hasInvitationEmailAllowlist(invitation: Invitation): boolean {
  return getInvitationEmailAllowlistCount(invitation) > 0;
}

export function isEmailAllowedByInvitation(invitation: Invitation, email?: string): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }

  const hashes = getInvitationEmailHashes(invitation);
  if (hashes.length > 0) {
    return hashes.includes(hashSecuritySignal('email', normalized));
  }

  return getInvitationEmailAllowlist(invitation).includes(normalized);
}

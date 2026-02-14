import { Invitation } from '../types';

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

  const metadataEmails = (invitation.metadata?.constraints as { emails?: string[] } | undefined)?.emails;
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

export function isEmailAllowedByInvitation(invitation: Invitation, email?: string): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }

  return getInvitationEmailAllowlist(invitation).includes(normalized);
}

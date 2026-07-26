/**
 * Returns a safe visual label for a signed invitation URL. The full credential
 * remains available to copy but is not painted into screenshots or recordings.
 */
export function compactInvitationUrl(inviteUrl: string): string {
  try {
    const url = new URL(inviteUrl);
    return `${url.origin}/invite/[secure token]`;
  } catch {
    return 'Secure invitation link';
  }
}

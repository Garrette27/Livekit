/**
 * Resend throttle for emailed links (the "Resend in 0:42" pattern used by
 * sign-in and verification screens). One window per recipient: a second
 * request inside it is refused in the UI before reaching Firebase, which also
 * rate-limits on its side. The window is a courtesy guard against repeated
 * clicks and duplicate emails, not a security control.
 */
export const RESEND_WINDOW_MS = 60_000;

/** Whole seconds left before `sentAt` (ms) allows another send; 0 when allowed or never sent. */
export function resendSecondsLeft(sentAt: number | undefined, now: number, windowMs = RESEND_WINDOW_MS): number {
  if (!sentAt) return 0;
  return Math.max(0, Math.ceil((sentAt + windowMs - now) / 1000));
}

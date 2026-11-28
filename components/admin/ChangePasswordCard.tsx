'use client';

import { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, updatePassword, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export const MIN_PASSWORD_LENGTH = 8;

/** Validate a proposed new password; returns the problem to show, or null. */
export function newPasswordProblem(current: string, next: string, confirm: string): string | null {
  if (next.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (next !== confirm) return 'The new passwords do not match.';
  if (next === current) return 'Choose a password different from the current one.';
  return null;
}

/**
 * "Your account → Change password" for the signed-in administrator (including
 * the platform owner, whose authority comes from SUPER_ADMIN_EMAILS and is not
 * affected by a password change).
 *
 * Pattern: re-authenticate, then update — Firebase requires a recent sign-in
 * for updatePassword, and asking for the current password stops someone at an
 * unlocked computer from taking the account over. Accounts that sign in only
 * with Google have no password here; they get a link to add one by email
 * instead. Firebase signs out other sessions' refresh tokens on change.
 * The password is sent only to Firebase Auth; this app never stores or logs it.
 */
export default function ChangePasswordCard({ user }: { user: User }) {
  const hasPassword = user.providerData.some((provider) => provider.providerId === 'password');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const change = async () => {
    const problem = newPasswordProblem(current, next, confirm);
    if (problem) { setResult({ tone: 'error', text: problem }); return; }
    if (!user.email) { setResult({ tone: 'error', text: 'This account has no email address to verify against.' }); return; }
    setBusy(true);
    setResult(null);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
      await updatePassword(user, next);
      setCurrent(''); setNext(''); setConfirm('');
      setResult({ tone: 'ok', text: 'Password changed. Use the new password next time you sign in.' });
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      setResult({
        tone: 'error',
        text: code.includes('wrong-password') || code.includes('invalid-credential') ? 'The current password is incorrect.'
          : code.includes('too-many-requests') ? 'Too many attempts. Wait a few minutes and try again.'
            : code.includes('weak-password') ? 'Firebase rejected that password as too weak. Choose a longer one.'
              : 'The password was not changed. Check your connection and try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const emailSetupLink = async () => {
    if (!auth || !user.email) return;
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, user.email, { url: `${window.location.origin}/super-admin/login` });
      setResult({ tone: 'ok', text: `A link to set a password was sent to ${user.email}.` });
    } catch {
      setResult({ tone: 'error', text: 'The email could not be sent. Try again in a minute.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-labelledby="change-password-title">
      <h2 id="change-password-title">Your account · change password</h2>
      {hasPassword ? (
        <form onSubmit={(event) => { event.preventDefault(); void change(); }} className="pw-form">
          <input type="email" autoComplete="username" value={user.email ?? ''} readOnly hidden />
          <label><span>Current password</span>
            <input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label><span>New password</span>
            <input type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} value={next} onChange={(e) => setNext(e.target.value)} />
          </label>
          <label><span>Confirm new password</span>
            <input type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          <button type="submit" disabled={busy}>{busy ? 'Changing…' : 'Change password'}</button>
        </form>
      ) : (
        <p className="muted">
          You sign in with Google, so this account has no password here. Manage it in your Google account, or{' '}
          <button type="button" className="secondary inline" disabled={busy} onClick={() => void emailSetupLink()}>email me a link to add a password</button>.
        </p>
      )}
      {result && <p role="status" className={result.tone}>{result.text}</p>}
      <style jsx>{`
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.25rem 1.5rem; }
        h2 { font-size: 1.125rem; font-weight: 700; margin: 0 0 0.5rem; color: #111827; }
        .muted { color: #6b7280; font-size: 0.875rem; }
        label { display: grid; min-width: 0; gap: 0.3rem; font-size: 0.8125rem; font-weight: 600; color: #374151; }
        input { min-width: 0; width: 100%; box-sizing: border-box; padding: 0.55rem 0.7rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-size: 0.9375rem; }
        button { padding: 0.55rem 1rem; border-radius: 0.5rem; border: 1px solid #0f766e; background: #0f766e; color: #fff; font-weight: 600; cursor: pointer; }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
        .secondary { background: #fff; color: #0f766e; }
        .ok { color: #047857; font-size: 0.875rem; margin-top: 0.75rem; }
        .error { color: #b91c1c; font-size: 0.875rem; margin-top: 0.75rem; }
        .pw-form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; align-items: end; margin-top: .5rem; }
        .pw-form > button { justify-self: start; grid-column: 1 / -1; }
        @media (max-width: 640px) { .pw-form { grid-template-columns: 1fr; } }
        .inline { margin: 0; padding: .3rem .6rem; }
      `}</style>
    </section>
  );
}

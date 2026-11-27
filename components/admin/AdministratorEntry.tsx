'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, provider } from '@/lib/firebase';
import { fetchWorkspaceAccess } from '@/lib/auth/workspace-client';

/** Identity-only entry: creating an account never creates a role or clinician profile. */
export default function AdministratorEntry({ signup = false }: { signup?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const ready = Boolean(auth && provider);

  const checkAccess = async () => {
    if (!auth?.currentUser) throw new Error('Sign in with your administrator account first.');
    const access = await fetchWorkspaceAccess(auth.currentUser, true);
    if (access.administratorLevel) router.replace('/admin');
    else setMessage('Your account exists, but administrator access has not been granted. Ask the platform owner to grant Administrator for your clinic, then choose Check access again.');
  };

  useEffect(() => {
    // Entry remains usable while Firebase restores the session; no automatic
    // clinician navigation can race with the explicit administrator intent.
    setMessage(signup ? 'Create your sign-in identity, then ask the platform owner to grant access. Signup does not grant administrator privileges.' : 'Use the account granted administrator access by the platform owner.');
  }, [signup]);

  const perform = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try { await operation(); }
    catch { setError('Unable to complete sign-in or access check. Verify your credentials, connection and account access, then retry.'); }
    finally { setBusy(false); }
  };

  return <main className="admin-entry">
    <section className="entry-card" aria-labelledby="admin-entry-title">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/teleconsole-logo.svg" width="44" height="44" alt="TeleConsole" />
      <p className="eyebrow">Clinic administration</p>
      <h1 id="admin-entry-title">{signup ? 'Create an administrator sign-in account' : 'Administrator sign in'}</h1>
      <p className="explanation">{signup ? 'Account creation and permission approval are separate steps.' : 'Return to your clinic administration workspace.'}</p>
      {!ready && <p role="alert">Sign-in is unavailable. Check the deployment configuration or contact the platform owner.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {message && <p role="status" className="notice">{message}</p>}
      <button type="button" disabled={busy || !ready} onClick={() => void perform(async () => {
        await signInWithPopup(auth!, provider!);
        await checkAccess();
      })}>Continue with Google</button>
      <p className="separator">or use email and password</p>
      <form onSubmit={(event) => { event.preventDefault(); void perform(async () => {
        if (!auth) throw new Error('Sign-in unavailable');
        if (signup) {
          const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
          try {
            await sendEmailVerification(result.user);
            setMessage('Account created. Check your inbox to verify your email. An authorized platform owner must separately grant your clinic access.');
          } catch {
            setMessage('Account created, but the verification email could not be sent. Contact the platform owner before requesting access.');
          }
        } else {
          await signInWithEmailAndPassword(auth, email.trim(), password);
          await checkAccess();
        }
      }); }}>
        <label htmlFor="administrator-email">Email address</label>
        <input id="administrator-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <label htmlFor="administrator-password">Password</label>
        <input id="administrator-password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} />
        <button type="submit" disabled={busy || !ready}>{busy ? 'Checking…' : signup ? 'Create sign-in account' : 'Sign in to administration'}</button>
      </form>
      <button className="secondary" type="button" disabled={busy || !ready} onClick={() => void perform(checkAccess)}>Check access again</button>
      <p><Link href={signup ? '/admin/login' : '/admin/signup'}>{signup ? 'Already have an account? Sign in' : 'Need a sign-in account? Create one'}</Link></p>
      <p><Link href="/doctor/login">Doctor sign in</Link> · <Link href="/patient/login">Patient sign in</Link></p>
      <button className="secondary" type="button" disabled={busy} onClick={() => void perform(async () => { await auth?.signOut(); setMessage('Signed out. You can choose another account.'); })}>Sign out / use another account</button>
    </section>
    <style jsx>{`
      .admin-entry { min-height: 100vh; background: #f0fdfa; padding: 2rem 1rem; display: grid; place-items: center; color: #153530; }
      .entry-card { width: 100%; max-width: 30rem; min-width: 0; background: white; border: 1px solid #ccdedb; border-radius: 1rem; padding: clamp(1rem, 4vw, 2rem); }
      .eyebrow { color: #0f766e; font-size: .85rem; margin-top: .75rem; font-weight: 600; }
      h1 { font-size: 1.6rem; margin: .4rem 0; line-height: 1.2; }
      p { line-height: 1.5; margin: .75rem 0; overflow-wrap: anywhere; }
      .explanation, .separator { color: #526562; font-size: .875rem; }
      .notice { background: #f0fdfa; padding: .75rem; border-left: 3px solid #0f766e; font-size: .875rem; }
      .error { color: #991b1b; }
      form { display: grid; gap: .6rem; margin-bottom: .75rem; }
      label { font-weight: 600; font-size: .875rem; }
      input { min-width: 0; width: 100%; padding: .7rem; border: 1px solid #a9c2bd; border-radius: .4rem; }
      button { width: 100%; min-height: 2.75rem; padding: .65rem; background: #0f766e; color: white; border: 1px solid #0f766e; border-radius: .4rem; font-weight: 600; cursor: pointer; }
      button:disabled { opacity: .6; cursor: not-allowed; }
      .secondary { background: white; color: #0f766e; }
      a { color: #0f766e; text-decoration: underline; }
      input:focus-visible, button:focus-visible, a:focus-visible { outline: 3px solid #14b8a6; outline-offset: 2px; }
    `}</style>
  </main>;
}

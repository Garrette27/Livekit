'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, provider } from '@/lib/firebase';
import { fetchWorkspaceAccess } from '@/lib/auth/workspace-client';

/** Role-specific entry: the server projection selects the workspace; signup creates only an identity. */
export default function AdministratorEntry({ signup = false, administratorLevel = 'admin' }: {
  signup?: boolean;
  administratorLevel?: 'admin' | 'super_admin';
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // Who is signed in right now, so the access refresh and sign-out controls
  // appear only when there is a session they can act on.
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const ready = Boolean(auth && provider);
  const platformOwner = administratorLevel === 'super_admin';

  /** A successful Firebase sign-in still needs the exact authority requested by this entry page. */
  const checkAccess = async () => {
    if (!auth?.currentUser) throw new Error('Sign in with your administrator account first.');
    const access = await fetchWorkspaceAccess(auth.currentUser, true);
    if (access.administratorLevel !== administratorLevel) {
      setMessage('');
      setError(platformOwner
        ? 'This sign-in is for the configured super administrator. Use the sign-in page for your account role.'
        : 'This sign-in requires clinic administrator access. Ask the platform owner to grant access, or use the sign-in page for your account role.');
      await auth.signOut();
      return;
    }
    router.replace('/admin');
  };

  useEffect(() => (auth ? onAuthStateChanged(auth, (current) => setSignedInEmail(current ? current.email || 'this account' : null)) : undefined), []);

  useEffect(() => {
    // Entry remains usable while Firebase restores the session; no automatic
    // clinician navigation can race with the explicit administrator intent.
    setMessage(signup
      ? 'Create your sign-in identity, then ask the platform owner to grant access. Signup does not grant administrator privileges.'
      : platformOwner
        ? 'Use the provider-verified account configured as the platform owner.'
        : 'Use the account granted administrator access by the platform owner.');
  }, [signup, platformOwner]);

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
      <p className="eyebrow">{platformOwner ? 'Platform administration' : 'Clinic administration'}</p>
      <h1 id="admin-entry-title">{signup ? 'Create a clinic administrator sign-in account' : platformOwner ? 'Super administrator sign in' : 'Clinic administrator sign in'}</h1>
      <p className="explanation">{signup ? 'Account creation and permission approval are separate steps.' : platformOwner ? 'Manage clinic administrators and staff access.' : 'Return to your clinic administration workspace.'}</p>
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
      {signedInEmail && (
        // Account switcher, shown only while a session exists: the refresh
        // re-reads access after an owner grant (new claims need a new ID
        // token); sign out lets a shared computer switch accounts.
        <div className="account-bar" role="group" aria-label="Current sign-in">
          <span className="account-email">Signed in as <strong>{signedInEmail}</strong></span>
          <button className="icon-button" type="button" disabled={busy || !ready} onClick={() => void perform(checkAccess)}
            title="Check access again" aria-busy={busy}>
            <svg className={busy ? 'spin' : undefined} aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" /><path d="M21 3v5h-5" />
            </svg>
            <span className="visually-hidden">Check access again</span>
          </button>
          <button className="link-button" type="button" disabled={busy} onClick={() => void perform(async () => { await auth?.signOut(); setMessage('Signed out. You can sign in with another account.'); })}>Sign out</button>
        </div>
      )}
      {!platformOwner && <p className="switch-entry">{signup ? 'Already have an account? ' : 'Need a sign-in account? '}<Link href={signup ? '/admin/login' : '/admin/signup'}>{signup ? 'Sign in' : 'Create one'}</Link></p>}
      <nav className="other-entries" aria-label="Other sign-in pages">
        <span>Not an administrator?</span>
        <Link href="/doctor/login">Doctor sign in →</Link>
        <Link href="/patient/login">Patient sign in →</Link>
      </nav>
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
      /* next/link renders its own <a>, which styled-jsx scoping does not reach;
         :global keeps the links visibly links (colour, underline, pointer). */
      .entry-card :global(a) { color: #0f766e; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
      .entry-card :global(a:hover) { color: #115e59; text-decoration-thickness: 2px; }
      .entry-card :global(a:focus-visible), input:focus-visible, button:focus-visible { outline: 3px solid #14b8a6; outline-offset: 2px; border-radius: .25rem; }
      .switch-entry { font-size: .9rem; text-align: center; }
      .other-entries { display: flex; flex-wrap: wrap; gap: .5rem 1.25rem; align-items: center; justify-content: center; padding-top: .75rem; margin-top: .75rem; border-top: 1px solid #e2ece9; font-size: .875rem; }
      .other-entries span { color: #526562; flex-basis: 100%; text-align: center; }
      .account-bar { display: flex; align-items: center; gap: .5rem; padding: .5rem .75rem; margin: .75rem 0; background: #f8fafa; border: 1px solid #e2ece9; border-radius: .5rem; font-size: .85rem; }
      .account-email { flex: 1; min-width: 0; overflow-wrap: anywhere; color: #526562; }
      .account-email strong { color: #153530; }
      .icon-button { width: 2.75rem; min-width: 2.75rem; height: 2.75rem; padding: 0; display: inline-grid; place-items: center; background: white; color: #0f766e; border-radius: 999px; }
      .icon-button:hover:not(:disabled) { background: #f0fdfa; }
      .link-button { width: auto; min-height: 2.75rem; padding: 0 .5rem; background: none; border: none; color: #0f766e; text-decoration: underline; text-underline-offset: 3px; }
      .visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
      .spin { animation: spin 0.9s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
    `}</style>
  </main>;
}

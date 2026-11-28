'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, sendPasswordResetEmail, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { authenticatedFetch } from '@/lib/auth/authenticated-fetch';
import DoctorAppHeader from '@/components/doctor/DoctorAppHeader';
import OversightPanel from '@/components/admin/OversightPanel';
import RefreshIconButton from '@/components/ui/RefreshIconButton';
import ChangePasswordCard from '@/components/admin/ChangePasswordCard';
import { resendSecondsLeft } from '@/lib/auth/resend-cooldown';

interface Account {
  uid: string;
  email: string | null;
  name: string | null;
  role: string;
  clinicId: string | null;
  provisioned: boolean;
  disabled: boolean;
  authority: 'server_bootstrap' | 'custom_claims' | 'legacy_profile' | 'disabled' | 'account_missing';
  canManage: boolean;
}

type Feedback = { tone: 'ok' | 'error'; text: string } | null;

/**
 * Administration console: add people and grant or revoke the doctor (and, for
 * super admins, admin) role. Adding someone new follows the invite pattern
 * used by workspace products: name + email + role, the server creates the
 * account without a password, and Firebase emails the person a link to set
 * their own. No administrator chooses, sees or transmits a password. Object-centred list of clinician accounts with their state
 * ("Provisioned" vs "Legacy profile"), one compact grant form, and modeless
 * inline feedback. The server re-checks every action; this page is only a
 * convenient surface over /api/admin/roles.
 */
export default function AdminPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [level, setLevel] = useState<'super_admin' | 'admin' | null>(null);
  const [callerUid, setCallerUid] = useState('');
  const [callerClinic, setCallerClinic] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState('');
  const [personName, setPersonName] = useState('');
  const [createIfMissing, setCreateIfMissing] = useState(true);
  const [role, setRole] = useState<'doctor' | 'admin'>('doctor');
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // When each set-password email was last sent (per recipient), and a 1 s
  // clock that only ticks while some cooldown is running.
  const [sentAt, setSentAt] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const coolingDown = Object.values(sentAt).some((at) => resendSecondsLeft(at, now) > 0);
  useEffect(() => {
    if (!coolingDown) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [coolingDown]);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => (auth ? onAuthStateChanged(auth, setUser) : setUser(null)), []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
    await auth?.currentUser?.getIdToken(true);
    const response = await authenticatedFetch('/api/admin/roles');
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      setLoadError(data.error || 'Could not load accounts.');
      return;
    }
    setLevel(data.level);
    setCallerUid(data.callerUid);
    setCallerClinic(data.clinicId);
    setAccounts(data.accounts);
    } catch {
      setLoadError('Could not check administrator access. Please retry.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
    else { setLevel(null); setAccounts([]); setLoaded(false); }
  }, [user, load]);

  /** Ask Firebase to email a set-password link; the link lands on that role's sign-in page. */
  const emailSetPasswordLink = async (targetEmail: string, targetRole: string) => {
    if (!auth) throw new Error('Sign-in unavailable');
    if (resendSecondsLeft(sentAt[targetEmail], Date.now()) > 0) throw new Error('cooldown');
    await sendPasswordResetEmail(auth, targetEmail, { url: `${window.location.origin}${targetRole === 'admin' ? '/admin/login' : '/doctor/login'}` });
    const at = Date.now();
    setSentAt((current) => ({ ...current, [targetEmail]: at }));
    setNow(at);
  };

  const resendSetPassword = async (targetEmail: string, targetRole: string) => {
    setBusy(`reset:${targetEmail}`);
    setFeedback(null);
    try {
      await emailSetPasswordLink(targetEmail, targetRole);
      setFeedback({ tone: 'ok', text: `Set-password email sent to ${targetEmail}. Ask them to check spam if it does not arrive within a few minutes.` });
    } catch {
      setFeedback({ tone: 'error', text: `Could not send the set-password email to ${targetEmail}. Retry, or ask them to use "Forgot password?" on the sign-in page.` });
    } finally {
      setBusy(null);
    }
  };

  const change = async (targetEmail: string, targetRole: 'doctor' | 'admin', action: 'grant' | 'revoke', targetClinic?: string | null, invite?: { name: string }) => {
    setBusy(`${action}:${targetEmail}`);
    setFeedback(null);
    try {
      const response = await authenticatedFetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, role: targetRole, action, clinicId: targetClinic ?? clinicId, ...(invite ? { createAccount: true, name: invite.name } : {}) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setFeedback({ tone: 'error', text: data.error || 'The change was not applied.' });
        return;
      }
      let invited = '';
      if (data.accountCreated) {
        invited = await emailSetPasswordLink(targetEmail, targetRole).then(
          () => ` Account created and a set-password email was sent to ${targetEmail}.`,
          () => ' Account created, but the set-password email could not be sent — use "Email set-password link" on their row.',
        );
      }
      setFeedback({
        tone: 'ok',
        text: `${action === 'grant' ? 'Granted' : 'Revoked'} ${targetRole} for ${targetEmail}.${invited} Granted roles apply at their next sign-in or within an hour; revoked roles end their other sessions.`,
      });
      if (action === 'grant') { setEmail(''); setPersonName(''); }
      await load();
    } catch {
      setFeedback({ tone: 'error', text: 'The request could not be confirmed. Refresh the account list before retrying.' });
    } finally {
      setBusy(null);
    }
  };

  if (user === undefined) return <main style={{ padding: '2rem' }}>Loading…</main>;
  if (!user) {
    return (
      <main style={{ minHeight: '100vh', padding: '2rem 1rem', display: 'grid', placeItems: 'center', background: '#f0fdfa', color: '#153530' }}>
        <section style={{ maxWidth: '30rem', padding: '2rem', background: 'white', border: '1px solid #ccdedb', borderRadius: '1rem' }}>
          <h1>Clinic administration</h1>
          <p style={{ margin: '1rem 0' }}>Sign in with your administrator account to manage clinician access.</p>
          <a href="/admin/login" style={{ display: 'inline-block', padding: '.75rem 1rem', borderRadius: '.5rem', background: '#0f766e', color: 'white' }}>Clinic administrator sign in</a>
          <p style={{ marginTop: '1rem' }}><a href="/super-admin/login" style={{ color: '#0f766e', textDecoration: 'underline' }}>Super administrator sign in</a></p>
          <p style={{ marginTop: '1rem' }}><a href="/admin/signup" style={{ color: '#0f766e', textDecoration: 'underline' }}>Create a sign-in account</a> · Access requires owner approval.</p>
        </section>
      </main>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <DoctorAppHeader
        title="Administration"
        subtitle={level === 'super_admin' ? 'Platform administrator · clinician accounts' : `Clinic administrator${callerClinic ? ` · ${callerClinic}` : ''}`}
        user={user}
        doctorAccess={false}
        navLink={{ href: '/doctor/invitations', label: 'Invitations' }}
      />
      <main style={{ maxWidth: '60rem', margin: '0 auto', padding: 'var(--page-padding)', display: 'grid', gap: '1.5rem' }}>
        {!loaded ? <p role="status">Checking administrator access…</p> : loadError ? (
          <section className="card" role="alert">
            <h2>Not available</h2>
            <p>{loadError}</p>
            <button onClick={() => void load()}>Refresh access</button>
          </section>
        ) : (
          <>
            <section className="card">
              <h2>Add a person or grant a role</h2>
              <p className="muted">
                Enter their name and work email. If they have no account yet, one is created and Firebase emails them
                a link to set their own password — you never choose or see it. Existing accounts (Google or email)
                just receive the role. Patient accounts cannot be converted; clinicians use a separate account.{' '}
                {level === 'super_admin'
                  ? 'As super admin you choose the clinic; grant "Administrator" to create a clinic admin.'
                  : `You manage doctors in your clinic${callerClinic ? ` (${callerClinic})` : ''} only.`}
              </p>
              <form
                className="grant-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (email.trim()) void change(email.trim().toLowerCase(), role, 'grant', level === 'super_admin' ? clinicId : callerClinic, createIfMissing ? { name: personName } : undefined);
                }}
              >
                <label>
                  <span>Full name</span>
                  <input autoComplete="off" value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Dr. Ana Reyes" maxLength={120} />
                </label>
                <label>
                  <span>Account email</span>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="clinician@clinic.example" />
                </label>
                <label>
                  <span>Clinic</span>
                  {level === 'super_admin' ? (
                    <input required value={clinicId} onChange={(e) => setClinicId(e.target.value)} placeholder="henry-cheung-dental" />
                  ) : (
                    <input value={callerClinic || '(not assigned)'} readOnly aria-readonly="true" />
                  )}
                </label>
                <label>
                  <span>Role</span>
                  <select value={role} onChange={(e) => setRole(e.target.value as 'doctor' | 'admin')}>
                    <option value="doctor">Doctor</option>
                    {level === 'super_admin' && <option value="admin">Administrator</option>}
                  </select>
                </label>
                <label className="checkbox">
                  <input type="checkbox" checked={createIfMissing} onChange={(e) => setCreateIfMissing(e.target.checked)} />
                  <span>Create the account and email a set-password link if this email has no account yet</span>
                </label>
                <button type="submit" disabled={Boolean(busy)}>{busy?.startsWith('grant') ? 'Saving…' : createIfMissing ? 'Add person' : 'Grant role'}</button>
              </form>
              <p className="muted grant-preview">{role === 'admin' ? 'Administrator grants clinic staff-management access only, not doctor access. Use a separate provisioned identity for consultations.' : 'Doctor grants clinician access only. It does not grant clinic administration.'}</p>
              {feedback && (
                <p role="status" className={feedback.tone === 'ok' ? 'ok' : 'error'}>{feedback.text}</p>
              )}
            </section>

            <section className="card">
              <div className="card-header">
                <h2>Clinician and administrator accounts ({accounts.length})</h2>
                <RefreshIconButton
                  label="Refresh access and accounts"
                  hint="Re-checks your own administrator access and reloads this list, so roles granted or revoked since the page opened (here or elsewhere) appear."
                  busy={refreshing}
                  onClick={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}
                />
              </div>
              {accounts.length === 0 ? (
                <p className="muted">No clinician accounts yet.</p>
              ) : (
                <ul className="accounts">
                  {accounts.map((account) => (
                    <li key={account.uid}>
                      <div>
                        <strong>{account.name || account.email || account.uid.slice(0, 8)}</strong>
                        <span className="muted">{account.email}</span>
                      </div>
                      <span className="badge">{account.role === 'super_admin' ? 'Super administrator' : account.role === 'admin' ? 'Clinic administrator' : account.role}</span>
                      <span className="badge">{account.role === 'super_admin' ? 'Platform-wide administration' : account.clinicId || 'No clinic assigned'}</span>
                      <span className={account.provisioned ? 'badge ok-badge' : 'badge warn-badge'}>
                        {account.authority === 'server_bootstrap' ? 'Server bootstrap' : account.authority === 'disabled' ? 'Account disabled' : account.authority === 'account_missing' ? 'Authentication account missing' : account.provisioned ? 'Provisioned' : 'Legacy clinician profile — needs provisioning'}
                      </span>
                      <div className="actions">
                        {account.canManage && !account.provisioned && account.email && account.uid !== callerUid && (
                          <button type="button" disabled={Boolean(busy)} onClick={() => change(account.email!, account.role as 'doctor' | 'admin', 'grant', account.clinicId || (level === 'super_admin' ? clinicId : callerClinic))}>
                            Provision
                          </button>
                        )}
                        {account.canManage && account.email && account.uid !== callerUid && (account.role === 'doctor' || level === 'super_admin') && (
                          <span className="resend">
                            <button type="button" className="secondary"
                              disabled={Boolean(busy) || resendSecondsLeft(sentAt[account.email!], now) > 0}
                              aria-describedby={`resend-${account.uid}`}
                              onClick={() => void resendSetPassword(account.email!, account.role)}>
                              {busy === `reset:${account.email}` ? 'Sending…'
                                : resendSecondsLeft(sentAt[account.email!], now) > 0 ? `Resend in ${resendSecondsLeft(sentAt[account.email!], now)}s`
                                  : sentAt[account.email!] ? 'Resend set-password link' : 'Email set-password link'}
                            </button>
                            {sentAt[account.email!] && (
                              <span id={`resend-${account.uid}`} className="sent" role="status">
                                ✓ Sent {new Date(sentAt[account.email!]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              </span>
                            )}
                          </span>
                        )}
                        {account.canManage && account.email && account.uid !== callerUid && (account.role === 'doctor' || level === 'super_admin') && (
                          <button type="button" className="danger" disabled={Boolean(busy)} onClick={() => change(account.email!, account.role as 'doctor' | 'admin', 'revoke', account.clinicId)}>
                            Revoke
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <ChangePasswordCard user={user} />

            <OversightPanel staffLabels={Object.fromEntries(accounts.map((account) => [account.uid, account.name || account.email || account.uid.slice(0, 8)]))} />
          </>
        )}
      </main>
      <style jsx>{`
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.25rem 1.5rem; }
        .card-header { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: .5rem; }
        .card-header h2 { margin: 0; }
        h2 { font-size: 1.125rem; font-weight: 700; margin: 0 0 0.5rem; color: #111827; }
        .muted { color: #6b7280; font-size: 0.8125rem; }
        .grant-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; align-items: end; margin-top: 0.75rem; }
        .grant-row > button, .grant-row > .checkbox { justify-self: start; grid-column: 1 / -1; }
        .checkbox { display: flex; align-items: center; gap: .5rem; font-weight: 500; }
        .checkbox input { width: auto; }
        .grant-preview { margin-top: .75rem; }
        label { display: grid; min-width: 0; gap: 0.3rem; font-size: 0.8125rem; font-weight: 600; color: #374151; }
        input, select { min-width: 0; width: 100%; box-sizing: border-box; padding: 0.55rem 0.7rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-size: 0.9375rem; }
        button { padding: 0.55rem 1rem; border-radius: 0.5rem; border: 1px solid #0f766e; background: #0f766e; color: #fff; font-weight: 600; cursor: pointer; }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
        .danger { background: #fff; color: #b91c1c; border-color: #fecaca; }
        .secondary { background: #fff; color: #0f766e; margin: .5rem 0; }
        .ok { color: #047857; font-size: 0.875rem; margin-top: 0.75rem; }
        .error { color: #b91c1c; font-size: 0.875rem; margin-top: 0.75rem; }
        .accounts { list-style: none; padding: 0; margin: 0.5rem 0 0; display: grid; gap: 0.5rem; }
        .accounts li { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between; border: 1px solid #f3f4f6; border-radius: 0.5rem; padding: 0.6rem 0.8rem; }
        .accounts li > div:first-child { display: grid; min-width: 0; flex: 1 1 12rem; overflow-wrap: anywhere; }
        .badge { font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 999px; background: #f3f4f6; color: #374151; }
        .ok-badge { background: #d1fae5; color: #065f46; }
        .warn-badge { background: #fef3c7; color: #92400e; }
        .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .actions .secondary { margin: 0; }
        .resend { display: inline-flex; align-items: center; gap: .5rem; }
        .sent { color: #047857; font-size: .8125rem; font-weight: 600; white-space: nowrap; }
        @media (min-width: 641px) and (max-width: 900px) { .grant-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px) { .grant-row { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

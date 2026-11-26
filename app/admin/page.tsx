'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { authenticatedFetch } from '@/lib/auth/authenticated-fetch';
import DoctorAppHeader from '@/components/doctor/DoctorAppHeader';

interface Account {
  uid: string;
  email: string | null;
  name: string | null;
  role: string;
  clinicId: string | null;
  provisioned: boolean;
  disabled: boolean;
}

type Feedback = { tone: 'ok' | 'error'; text: string } | null;

/**
 * Administration console: grant or revoke the doctor (and, for super admins,
 * admin) role. Object-centred list of clinician accounts with their state
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
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'doctor' | 'admin'>('doctor');
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => (auth ? onAuthStateChanged(auth, setUser) : setUser(null)), []);

  const load = useCallback(async () => {
    setLoadError(null);
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
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const change = async (targetEmail: string, targetRole: 'doctor' | 'admin', action: 'grant' | 'revoke', targetClinic?: string | null) => {
    setBusy(`${action}:${targetEmail}`);
    setFeedback(null);
    try {
      const response = await authenticatedFetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, role: targetRole, action, clinicId: targetClinic ?? clinicId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setFeedback({ tone: 'error', text: data.error || 'The change was not applied.' });
        return;
      }
      setFeedback({
        tone: 'ok',
        text: `${action === 'grant' ? 'Granted' : 'Revoked'} ${targetRole} for ${targetEmail}. Granted roles apply at their next sign-in or within an hour; revoked roles end their other sessions.`,
      });
      if (action === 'grant') setEmail('');
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (user === undefined) return <main style={{ padding: '2rem' }}>Loading…</main>;
  if (!user) {
    return (
      <main style={{ padding: '2rem' }}>
        <p>Sign in with your administrator account first.</p>
        <a href="/doctor/login">Go to sign in</a>
      </main>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <DoctorAppHeader
        title="Administration"
        subtitle={level === 'super_admin' ? 'Super admin · clinician accounts' : 'Clinician accounts'}
        user={user}
        navLink={{ href: '/doctor/invitations', label: 'Invitations' }}
      />
      <main style={{ maxWidth: '60rem', margin: '0 auto', padding: 'var(--page-padding)', display: 'grid', gap: '1.5rem' }}>
        {loadError ? (
          <section className="card" role="alert">
            <h2>Not available</h2>
            <p>{loadError}</p>
          </section>
        ) : (
          <>
            <section className="card">
              <h2>Grant a role</h2>
              <p className="muted">
                The clinician must have signed in once (Google or email) so the account exists. Patient accounts
                cannot be converted; clinicians use a separate account.{' '}
                {level === 'super_admin'
                  ? 'As super admin you choose the clinic; grant "Administrator" to create a clinic admin.'
                  : `You manage doctors in your clinic${callerClinic ? ` (${callerClinic})` : ''} only.`}
              </p>
              <form
                className="grant-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (email.trim()) void change(email.trim().toLowerCase(), role, 'grant', level === 'super_admin' ? clinicId : callerClinic);
                }}
              >
                <label>
                  <span>Account email</span>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="doctor@clinic.example" />
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
                <button type="submit" disabled={Boolean(busy)}>{busy?.startsWith('grant') ? 'Granting…' : 'Grant role'}</button>
              </form>
              {feedback && (
                <p role="status" className={feedback.tone === 'ok' ? 'ok' : 'error'}>{feedback.text}</p>
              )}
            </section>

            <section className="card">
              <h2>Clinician and administrator accounts ({accounts.length})</h2>
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
                      <span className="badge">{account.role}</span>
                      <span className="badge">{account.clinicId || 'no clinic'}</span>
                      <span className={account.provisioned ? 'badge ok-badge' : 'badge warn-badge'}>
                        {account.provisioned ? 'Provisioned' : 'Legacy profile — grant to provision'}
                      </span>
                      <div className="actions">
                        {!account.provisioned && account.email && (
                          <button type="button" disabled={Boolean(busy)} onClick={() => change(account.email!, account.role as 'doctor' | 'admin', 'grant', account.clinicId || (level === 'super_admin' ? clinicId : callerClinic))}>
                            Provision
                          </button>
                        )}
                        {account.email && account.uid !== callerUid && (account.role === 'doctor' || level === 'super_admin') && (
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
          </>
        )}
      </main>
      <style jsx>{`
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1.25rem 1.5rem; }
        h2 { font-size: 1.125rem; font-weight: 700; margin: 0 0 0.5rem; color: #111827; }
        .muted { color: #6b7280; font-size: 0.8125rem; }
        .grant-row { display: grid; grid-template-columns: minmax(12rem, 1fr) minmax(10rem, 12rem) 9rem auto; gap: 0.75rem; align-items: end; margin-top: 0.75rem; }
        label { display: grid; gap: 0.3rem; font-size: 0.8125rem; font-weight: 600; color: #374151; }
        input, select { padding: 0.55rem 0.7rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-size: 0.9375rem; }
        button { padding: 0.55rem 1rem; border-radius: 0.5rem; border: 1px solid #0f766e; background: #0f766e; color: #fff; font-weight: 600; cursor: pointer; }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
        .danger { background: #fff; color: #b91c1c; border-color: #fecaca; }
        .ok { color: #047857; font-size: 0.875rem; margin-top: 0.75rem; }
        .error { color: #b91c1c; font-size: 0.875rem; margin-top: 0.75rem; }
        .accounts { list-style: none; padding: 0; margin: 0.5rem 0 0; display: grid; gap: 0.5rem; }
        .accounts li { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between; border: 1px solid #f3f4f6; border-radius: 0.5rem; padding: 0.6rem 0.8rem; }
        .accounts li > div:first-child { display: grid; min-width: 12rem; flex: 1; }
        .badge { font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 999px; background: #f3f4f6; color: #374151; }
        .ok-badge { background: #d1fae5; color: #065f46; }
        .warn-badge { background: #fef3c7; color: #92400e; }
        .actions { display: flex; gap: 0.5rem; }
        @media (max-width: 640px) { .grant-row { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

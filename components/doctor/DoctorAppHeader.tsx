'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { fetchWorkspaceAccess, type WorkspaceAccess } from '@/lib/auth/workspace-client';

/**
 * Account label for the signed-in clinician, strongest first: the account
 * email, then the display name, then a short account id. Showing who is signed
 * in (the "account chip" pattern of Google/Microsoft apps) lets a clinician on
 * a shared clinic computer confirm they are acting as themselves.
 */
export function accountLabel(user: Pick<User, 'email' | 'displayName' | 'uid'> | null | undefined): {
  primary: string;
  secondary: string | null;
  initial: string;
} {
  const email = user?.email?.trim() || null;
  const name = user?.displayName?.trim() || null;
  const primary = name || email || (user?.uid ? `user-${user.uid.slice(0, 6)}` : 'Signed in');
  const secondary = name && email ? email : null;
  return { primary, secondary, initial: primary.charAt(0).toUpperCase() };
}

interface DoctorAppHeaderProps {
  /** Current page name. Brand navigation always has a real workspace destination. */
  title: string;
  subtitle?: string;
  user: User | null | undefined;
  /** The other doctor page, e.g. Invitations <-> Consultation History. */
  navLink: { href: string; label: string };
  /** Administration already knows its effective level; avoid a clinical-link flash. */
  doctorAccess?: boolean;
}

/**
 * Shared top app bar for clinician pages: brand + page title (one clickable
 * box) on the left, navigation and the signed-in account on the right.
 */
export default function DoctorAppHeader({ title, subtitle, user, navLink, doctorAccess }: DoctorAppHeaderProps) {
  const pathname = usePathname();
  const account = accountLabel(user);
  const [access, setAccess] = useState<WorkspaceAccess | null>(null);
  useEffect(() => {
    let current = true;
    setAccess(null);
    if (user) void fetchWorkspaceAccess(user).then((next) => { if (current) setAccess(next); }).catch(() => {});
    return () => { current = false; };
  }, [user]);
  const homePath = pathname?.startsWith('/admin') ? '/admin' : access?.homePath || '/doctor/invitations';

  return (
    <header className="doctor-app-header">
      <div className="app-header-bar" style={{ maxWidth: '80rem', margin: '0 auto' }}>
        <a href={homePath} className="doctor-title-box" aria-label="TeleConsole workspace home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/teleconsole-logo.svg" alt="" width={36} height={36} />
          <span>
            <span className="doctor-title">{title}</span>
            {subtitle && <span className="doctor-subtitle">{subtitle}</span>}
          </span>
        </a>
        <nav className="doctor-header-actions" aria-label="Workspace navigation">
          {/* A full document navigation, not a client transition: the client
              transition between the two doctor pages could stall on the
              destination's auth initialisation (seen in production). */}
          {(doctorAccess ?? access?.doctorAccess) === true && <a href={navLink.href} className="doctor-nav-link">{navLink.label}</a>}
          {access?.doctorAccess && access.schedulingEnabled && pathname !== '/doctor/appointments' && <a href="/doctor/appointments" className="doctor-nav-link">Appointments</a>}
          {access?.doctorAccess && pathname === '/doctor/appointments' && <a href="/doctor/dashboard" className="doctor-nav-link">Consultation History</a>}
          {access?.administratorLevel && pathname !== '/admin' && <a href="/admin" className="doctor-nav-link">Administration</a>}
          <span className="doctor-account" title={account.secondary || account.primary}>
            <span className="doctor-avatar" aria-hidden="true">{account.initial}</span>
            <span className="doctor-account-text">
              <span className="doctor-account-primary">{account.primary}</span>
              {account.secondary && <span className="doctor-account-secondary">{account.secondary}</span>}
            </span>
          </span>
          <button type="button" className="doctor-signout" onClick={() => auth && auth.signOut()}>
            Sign out
          </button>
        </nav>
      </div>
      <style jsx>{`
        .doctor-app-header {
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          padding: var(--header-padding);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }
        :global(.doctor-title-box) {
          display: inline-flex;
          min-width: 0;
          max-width: 100%;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0.875rem 0.5rem 0.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          color: inherit;
          text-decoration: none;
          transition: background-color 120ms, border-color 120ms, box-shadow 120ms;
        }
        :global(.doctor-title-box > span) { min-width: 0; overflow-wrap: anywhere; }
        :global(.doctor-title-box > img) { flex: none; }
        :global(.doctor-title-box:hover) {
          background: #f0fdfa;
          border-color: #99f6e4;
          box-shadow: 0 1px 2px rgba(15, 118, 110, 0.15);
        }
        :global(.doctor-title-box:focus-visible) {
          outline: 3px solid #14b8a6;
          outline-offset: 2px;
        }
        .doctor-title {
          display: block;
          font-size: 1.25rem;
          font-weight: 700;
          color: #111827;
          line-height: 1.2;
        }
        .doctor-subtitle {
          display: block;
          font-size: 0.8125rem;
          color: #6b7280;
        }
        .doctor-header-actions {
          display: flex;
          max-width: 100%;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }
        :global(.doctor-nav-link) {
          color: #0f766e;
          font-weight: 600;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          min-height: 2.75rem;
          padding: .5rem .75rem;
          border: 1px solid transparent;
          border-radius: .5rem;
          transition: background-color 120ms, border-color 120ms;
        }
        :global(.doctor-nav-link:hover) { background: #f0fdfa; border-color: #99f6e4; }
        :global(.doctor-nav-link:focus-visible) { outline: 3px solid #14b8a6; outline-offset: 2px; }
        .doctor-account {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          max-width: 16rem;
        }
        .doctor-avatar {
          flex: none;
          width: 2rem;
          height: 2rem;
          border-radius: 999px;
          background: #ccfbf1;
          color: #115e59;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }
        .doctor-account-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .doctor-account-primary,
        .doctor-account-secondary {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .doctor-account-primary {
          font-size: 0.875rem;
          font-weight: 600;
          color: #111827;
        }
        .doctor-account-secondary {
          font-size: 0.75rem;
          color: #6b7280;
        }
        .doctor-signout {
          background: #ffffff;
          color: #b91c1c;
          border: 1px solid #fecaca;
          border-radius: 0.375rem;
          padding: 0.45rem 0.9rem;
          font-weight: 600;
          cursor: pointer;
        }
        .doctor-signout:hover {
          background: #fef2f2;
        }
      `}</style>
    </header>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/auth/authenticated-fetch';
import RefreshIconButton from '@/components/ui/RefreshIconButton';
import type { InvitationActivitySnapshot } from '@/lib/services/admin/invitation-activity-service';

const LIFECYCLE: Record<string, { label: string; color: string; background: string }> = {
  active: { label: 'Active', color: '#166534', background: '#dcfce7' },
  expired: { label: 'Expired', color: '#4b5563', background: '#f3f4f6' },
  revoked: { label: 'Revoked', color: '#b91c1c', background: '#fee2e2' },
  used: { label: 'Used', color: '#1d4ed8', background: '#dbeafe' },
};

const STATUS: Record<string, string> = {
  waiting: 'Waiting now',
  admitted: 'In consultation / admitted',
  left: 'Left',
  rejected: 'Not admitted by doctor',
};

/**
 * Administrator view of recent invitations: who created each one, its
 * lifecycle, and every visit it produced (when, how the visitor was
 * identified, and whether the doctor admitted them). Read-only; loaded only
 * when opened or refreshed. Patients appear by arrival type and a short
 * reference, never by name, because administration does not need clinical
 * identity; the owning doctor sees names in their queue.
 */
export default function InvitationActivityPanel() {
  const [open, setOpen] = useState(true);
  const [snapshot, setSnapshot] = useState<InvitationActivitySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch('/api/admin/invitation-activity');
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) setError(data.error || 'Could not load invitation activity.');
      else setSnapshot(data as InvitationActivitySnapshot);
    } catch {
      setError('Could not load invitation activity. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (open && !snapshot && !loading && !error) void load(); }, [open, snapshot, loading, error, load]);

  const when = (value: string | null) => (value ? new Date(value).toLocaleString() : '—');

  return (
    <section className="card" aria-labelledby="invitation-activity-title">
      <details open={open} onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}>
        <summary><h2 id="invitation-activity-title" style={{ display: 'inline' }}>Invitations and visits</h2></summary>
        <p className="muted">
          Who created each invitation and who came through it. Patients are shown by how they joined and a short reference, not by name.
        </p>
        {loading && <p role="status">Loading invitation activity…</p>}
        {error && <p role="alert" className="error">{error} <button type="button" className="secondary" onClick={() => void load()}>Retry</button></p>}
        {snapshot && (
          <>
            <p className="muted">
              {snapshot.scope === 'platform' ? 'All clinics' : 'Doctors in your clinic'} · newest {snapshot.invitations.length} invitations · as of {when(snapshot.generatedAt)}{' '}
              <RefreshIconButton
                label="Refresh invitations"
                hint="Reloads the newest invitations and their visits. Nothing refreshes on its own."
                busy={loading}
                onClick={() => void load()}
              />
            </p>
            {snapshot.invitations.length === 0 ? <p className="muted">No invitations yet.</p> : (
              <ol className="invites">
                {snapshot.invitations.map((invitation) => {
                  const lifecycle = LIFECYCLE[invitation.lifecycle];
                  return (
                    <li key={invitation.invitationRef}>
                      <div className="head">
                        <span className="badge" style={{ color: lifecycle.color, background: lifecycle.background }}>{lifecycle.label}</span>
                        <strong>Created {when(invitation.createdAt)}</strong>
                        <span>by {invitation.doctor.name}{invitation.doctor.email ? ` (${invitation.doctor.email})` : ''}</span>
                      </div>
                      <p className="muted">
                        Invitation #{invitation.invitationRef} · {invitation.usage} · expires {when(invitation.expiresAt)} ·{' '}
                        {invitation.visits.total === 0
                          ? 'no visits yet'
                          : `${invitation.visits.total} visit${invitation.visits.total === 1 ? '' : 's'}: ${invitation.visits.admitted} admitted, ${invitation.visits.waiting} waiting, ${invitation.visits.left} left, ${invitation.visits.rejected} not admitted`}
                      </p>
                      {invitation.arrivals.length > 0 && (
                        <table>
                          <caption className="sr-only">Visits through invitation #{invitation.invitationRef}</caption>
                          <thead><tr><th scope="col">Visitor</th><th scope="col">Arrived</th><th scope="col">Admission</th><th scope="col">Status</th></tr></thead>
                          <tbody>
                            {invitation.arrivals.map((arrival) => (
                              <tr key={arrival.visitorRef + (arrival.arrivedAt ?? '')}>
                                <td>{arrival.visitor} · #{arrival.visitorRef}</td>
                                <td>{when(arrival.arrivedAt)}</td>
                                <td>{arrival.admission}{arrival.admittedAt ? ` · ${when(arrival.admittedAt)}` : ''}</td>
                                <td>{STATUS[arrival.status]}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </details>
      <style jsx>{`
        summary { cursor: pointer; }
        .invites { list-style: none; padding: 0; margin: .5rem 0 0; display: grid; gap: .6rem; }
        .invites > li { border: 1px solid #e5e7eb; border-radius: .5rem; padding: .7rem .8rem; overflow-wrap: anywhere; }
        .head { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .75rem; font-size: .875rem; }
        .badge { font-size: .75rem; font-weight: 700; padding: .1rem .5rem; border-radius: 999px; }
        table { width: 100%; border-collapse: collapse; font-size: .8125rem; margin-top: .4rem; }
        th, td { text-align: left; padding: .35rem .4rem; border-top: 1px solid #f3f4f6; vertical-align: top; }
        th { color: #374151; font-weight: 600; }
        .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        .muted { color: #6b7280; font-size: 0.8125rem; }
        .error { color: #b91c1c; font-size: .875rem; }
        .secondary { padding: .3rem .7rem; border-radius: .5rem; border: 1px solid #0f766e; background: #fff; color: #0f766e; font-weight: 600; cursor: pointer; }
        @media (max-width: 640px) {
          thead { display: none; }
          tr { display: grid; border-top: 1px solid #f3f4f6; padding: .3rem 0; }
          td { border: none; padding: .1rem .2rem; }
        }
      `}</style>
    </section>
  );
}

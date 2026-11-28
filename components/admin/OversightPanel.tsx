'use client';

import { useCallback, useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/auth/authenticated-fetch';
import RefreshIconButton from '@/components/ui/RefreshIconButton';
import type { OversightSnapshot } from '@/lib/services/admin/oversight-service';

const ACTION_LABEL: Record<string, string> = {
  role_grant: 'Granted role',
  role_revoke: 'Revoked role',
};

/**
 * Read-only oversight for administrators: dated aggregate cards and the latest
 * page of administrative audit events from /api/admin/oversight. Staff ids are
 * shown with the staff label already visible on this page; patient identity
 * and clinical content are never part of this view. Open by default; collapsing
 * it skips the load (a visit costs a few dozen aggregate reads).
 */
export default function OversightPanel({ staffLabels }: { staffLabels: Record<string, string> }) {
  const [open, setOpen] = useState(true);
  const [snapshot, setSnapshot] = useState<OversightSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch('/api/admin/oversight');
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) setError(data.error || 'Could not load oversight.');
      else setSnapshot(data as OversightSnapshot);
    } catch {
      setError('Could not load oversight. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (open && !snapshot && !loading) void load(); }, [open, snapshot, loading, load]);

  const who = (uid: string | null) => (uid ? staffLabels[uid] || `id ${uid.slice(0, 8)}…` : '—');
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'unknown time');

  return (
    <section className="card">
      <details open={open} onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}>
        <summary><h2 style={{ display: 'inline' }}>Oversight: activity and audit log</h2></summary>
        <p className="muted">
          Aggregate counts and administrative events only. No patient names, transcripts, summaries or chat are shown here.
        </p>
        {loading && <p role="status">Loading oversight…</p>}
        {error && <p role="alert" className="error">{error} <button type="button" className="secondary" onClick={() => void load()}>Retry</button></p>}
        {snapshot && (
          <>
            <p className="muted">
              {snapshot.scope === 'platform' ? 'Platform-wide' : 'Your clinic only'} · as of {when(snapshot.generatedAt)}{' '}
              <RefreshIconButton
                label="Refresh oversight"
                hint="Reloads the counts and the newest administrative events. Nothing refreshes on its own."
                busy={loading}
                onClick={() => void load()}
              />
            </p>
            <ul className="metrics">
              {snapshot.metrics.map((metric) => (
                <li key={metric.key}><strong>{metric.value.toLocaleString()}</strong><span>{metric.label}</span></li>
              ))}
            </ul>
            {snapshot.scope === 'platform' && (
              <p className="muted">
                Summary retention:{' '}
                {snapshot.retention
                  ? `last run ${when(snapshot.retention.ranAt)} · ${snapshot.retention.enabled ? `enforcing ${snapshot.retention.days} days, deleted ${snapshot.retention.deletedCount}` : `dry run, ${snapshot.retention.eligibleBefore} older than ${snapshot.retention.days} days`}`
                  : 'no run recorded yet'}
              </p>
            )}
            <h3>Recent administrative events ({snapshot.auditEvents.length})</h3>
            {snapshot.auditEvents.length === 0 ? <p className="muted">No administrative events recorded.</p> : (
              <ol className="events">
                {snapshot.auditEvents.map((event) => (
                  <li key={event.id}>
                    <span>{when(event.at)}</span>
                    <span><strong>{ACTION_LABEL[event.action] || event.action}</strong>{event.role ? ` · ${event.role}` : ''}</span>
                    <span>by {who(event.actorUid)} → {who(event.targetUid)}</span>
                    <span className="muted">{event.clinicId || 'no clinic'}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="muted">Showing the newest {snapshot.auditEvents.length} events (maximum 50). Role changes are recorded today; sign-in and denial events are planned.</p>
          </>
        )}
      </details>
      <style jsx>{`
        summary { cursor: pointer; }
        h3 { font-size: 1rem; margin: 1rem 0 .5rem; }
        .metrics { list-style: none; padding: 0; margin: .75rem 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: .5rem; }
        .metrics li { border: 1px solid #e5e7eb; border-radius: .5rem; padding: .6rem .75rem; display: grid; gap: .15rem; }
        .metrics strong { font-size: 1.35rem; color: #0f766e; }
        .metrics span { font-size: .8rem; color: #4b5563; }
        .events { list-style: none; padding: 0; margin: 0; display: grid; gap: .4rem; }
        .events li { display: flex; flex-wrap: wrap; gap: .5rem 1rem; font-size: .85rem; border: 1px solid #f3f4f6; border-radius: .5rem; padding: .5rem .7rem; overflow-wrap: anywhere; }
        .muted { color: #6b7280; font-size: 0.8125rem; }
        .error { color: #b91c1c; font-size: .875rem; }
        .secondary { padding: .3rem .7rem; border-radius: .5rem; border: 1px solid #0f766e; background: #fff; color: #0f766e; font-weight: 600; cursor: pointer; }
      `}</style>
    </section>
  );
}

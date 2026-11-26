'use client';

import { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/auth/authenticated-fetch';

/**
 * Inline editor for a live invitation's waiting limit. The new value applies
 * to the next arrival (the limit is read inside the reservation transaction);
 * lowering it never removes anyone already waiting.
 */
export default function WaitingLimitEditor({ invitationId, current }: { invitationId: string; current: number }) {
  const [value, setValue] = useState(current);
  const [state, setState] = useState<{ tone: 'idle' | 'saving' | 'ok' | 'error'; text?: string }>({ tone: 'idle' });

  useEffect(() => setValue(current), [current]);

  const save = async () => {
    setState({ tone: 'saving' });
    try {
      const response = await authenticatedFetch('/api/invite/limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId, maxPatients: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setState({ tone: 'error', text: data.error || 'Not saved' });
        return;
      }
      setState({ tone: 'ok', text: `Saved: up to ${data.maxPatients} waiting. Applies to the next arrival.` });
    } catch {
      setState({ tone: 'error', text: 'Network error — not saved' });
    }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
        Waiting limit{' '}
        <input
          type="number"
          min={1}
          max={100}
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          style={{ width: '4.5rem', padding: '0.3rem 0.4rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', marginLeft: '0.25rem' }}
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={state.tone === 'saving' || value === current}
        style={{ padding: '0.3rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #0f766e', background: '#fff', color: '#0f766e', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}
      >
        {state.tone === 'saving' ? 'Saving…' : 'Save limit'}
      </button>
      {state.text && (
        <span role="status" style={{ fontSize: '0.75rem', color: state.tone === 'error' ? '#b91c1c' : '#047857' }}>{state.text}</span>
      )}
    </div>
  );
}

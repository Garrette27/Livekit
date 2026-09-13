'use client';

import { useState, type CSSProperties } from 'react';
import { authenticatedFetch } from '@/lib/auth/authenticated-fetch';
import { TELEHEALTH_CONSENT } from '@/lib/consent/telehealth-consent';

interface TelehealthConsentStepProps {
  /** Email of the signed-in account, so the patient can see who they are joining as. */
  accountEmail: string | null;
  /** Called once the agreement is stored. The page then validates the invitation again. */
  onConsentRecorded: () => void;
  /** Signs out so the patient can come back with the account their doctor invited. */
  onUseDifferentAccount: () => void;
}

const linkButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: '#1d4ed8',
  textDecoration: 'underline',
  cursor: 'pointer',
  font: 'inherit',
};

/**
 * The one thing asked of a signed-in patient before their first consultation.
 *
 * It replaces a registration form that asked again for the email the account
 * already had, for a phone number nothing used, and for consent to store
 * device and network details. The account establishes who the patient is;
 * this asks only whether they agree, once per account.
 */
export default function TelehealthConsentStep({
  accountEmail,
  onConsentRecorded,
  onUseDifferentAccount,
}: TelehealthConsentStepProps) {
  const [agreed, setAgreed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordConsent = async () => {
    // Explained rather than disabled: a greyed-out button gives no reason, and
    // a keyboard or screen-reader user cannot reach it to find one.
    if (!agreed) {
      setError('Tick the box to agree before continuing.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await authenticatedFetch('/api/patient/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentVersion: TELEHEALTH_CONSENT.version }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!response.ok || !result.success) {
        setError(result.error || 'We could not save your agreement. Please try again.');
        setIsSaving(false);
        return;
      }
      onConsentRecorded();
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
      setIsSaving(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#eff6ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--page-padding)',
      }}
    >
      <section
        aria-labelledby="consent-title"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          padding: 'var(--card-padding)',
          boxShadow: '0 10px 30px -12px rgba(15, 23, 42, 0.25)',
          maxWidth: '34rem',
          width: '100%',
        }}
      >
        <h1 id="consent-title" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e3a8a', margin: '0 0 0.5rem' }}>
          Before you join
        </h1>
        <p style={{ fontSize: '0.9375rem', color: '#475569', margin: '0 0 1.25rem', lineHeight: 1.6 }}>
          Signed in as{' '}
          <strong style={{ color: '#0f172a', overflowWrap: 'anywhere' }}>
            {accountEmail || 'your account'}
          </strong>
          .{' '}
          <button type="button" onClick={onUseDifferentAccount} style={linkButtonStyle}>
            Use a different account
          </button>
        </p>

        <ul
          style={{
            margin: '0 0 1.25rem',
            paddingLeft: '1.25rem',
            color: '#334155',
            fontSize: '0.9375rem',
            lineHeight: 1.6,
            display: 'grid',
            gap: '0.5rem',
          }}
        >
          {TELEHEALTH_CONSENT.statements.map((statement) => (
            <li key={statement}>{statement}</li>
          ))}
        </ul>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            minHeight: '44px',
            padding: '0.875rem 1rem',
            marginBottom: '1rem',
            backgroundColor: '#f8fafc',
            border: `1px solid ${agreed ? '#2563eb' : '#cbd5e1'}`,
            borderRadius: '0.5rem',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => {
              setAgreed(event.target.checked);
              setError(null);
            }}
            disabled={isSaving}
            style={{ width: '1.25rem', height: '1.25rem', marginTop: '0.125rem', flexShrink: 0, cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.9375rem', color: '#0f172a', fontWeight: 500 }}>
            I have read this and agree.
          </span>
        </label>

        {error && (
          <p role="alert" style={{ color: '#b91c1c', fontSize: '0.875rem', margin: '0 0 1rem' }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={recordConsent}
          disabled={isSaving}
          style={{
            width: '100%',
            minHeight: '44px',
            padding: '0.75rem 1.25rem',
            borderRadius: '0.5rem',
            border: 'none',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: isSaving ? 'wait' : 'pointer',
            opacity: isSaving ? 0.8 : 1,
          }}
        >
          {isSaving ? 'Saving…' : 'Agree and continue'}
        </button>

        <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0.875rem 0 0', lineHeight: 1.5 }}>
          You only need to do this once for this account.
        </p>
      </section>
    </main>
  );
}

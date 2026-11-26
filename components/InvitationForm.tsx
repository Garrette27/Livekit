'use client';

import { useEffect, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { CreateInvitationRequest } from '@/lib/types';
import { describeInvitationAudience } from '@/lib/invitations/invitation-presentation';
import { REUSABLE_INVITATION_MAX_USES } from '@/lib/invitations/invitation-use-reservation';

interface InvitationFormProps {
  roomName: string;
  /** When provided, the room name is edited inside this form (compact layout). */
  onRoomNameChange?: (roomName: string) => void;
  onInvitationCreated?: (formData: CreateInvitationRequest) => Promise<void> | void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitEmails(text: string): string[] {
  return text.split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean);
}

/**
 * Compact "share a visit link" form, the pattern telehealth dashboards use
 * (one short row of settings, then create and copy). Settings that are short
 * values sit side by side; the optional direct-join list is a single-line chip
 * input (type or paste an address, Enter or comma adds it) instead of a large
 * text box; the explanation of the allowlist is one line with the full rule
 * behind progressive disclosure.
 */
export default function InvitationForm({ roomName, onRoomNameChange, onInvitationCreated }: InvitationFormProps) {
  const [formData, setFormData] = useState<CreateInvitationRequest>({
    roomName,
    expiresInHours: 24,
    waitingRoomEnabled: true,
    maxPatients: 10,
    maxUses: REUSABLE_INVITATION_MAX_USES,
  });
  const [emails, setEmails] = useState<string[]>([]);
  const [draftEmail, setDraftEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData((previous) => ({ ...previous, roomName }));
  }, [roomName]);

  const commitEmails = (text: string) => {
    const candidates = splitEmails(text);
    if (candidates.length === 0) return;
    const invalid = candidates.filter((email) => !EMAIL_PATTERN.test(email));
    setEmails((current) => Array.from(new Set([...current, ...candidates.filter((email) => EMAIL_PATTERN.test(email))])));
    setDraftEmail(invalid.join(', '));
    setError(invalid.length ? `Not a valid email: ${invalid.join(', ')}` : null);
  };

  const handleEmailKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
      if (draftEmail.trim()) {
        event.preventDefault();
        commitEmails(draftEmail);
      } else if (event.key === 'Enter') {
        event.preventDefault();
      }
    } else if (event.key === 'Backspace' && !draftEmail && emails.length) {
      setEmails((current) => current.slice(0, -1));
    }
  };

  const handleEmailPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    if (/[\s,;]/.test(text)) {
      event.preventDefault();
      commitEmails(`${draftEmail} ${text}`);
    }
  };

  const allowlist = Array.from(new Set([...emails, ...splitEmails(draftEmail).filter((email) => EMAIL_PATTERN.test(email))]));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.roomName.trim()) {
      setError('Enter a room name');
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      // Parent owns API side effects and result state.
      await onInvitationCreated?.({ ...formData, emailAllowlist: allowlist, emailAllowed: allowlist[0] });
    } catch (err) {
      console.error('Error creating invitation:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const hours = formData.expiresInHours || 24;
  const expiryLabel = hours >= 168 ? '1 week' : hours >= 72 ? `${hours / 24} days` : `${hours} hour${hours === 1 ? '' : 's'}`;

  return (
    <form onSubmit={handleSubmit} className="invite-form" noValidate>
      <div className="invite-row">
        <label className="invite-field invite-field--room">
          <span>Room name</span>
          <input
            type="text"
            value={roomName}
            onChange={(event) => (onRoomNameChange ? onRoomNameChange(event.target.value) : setFormData((p) => ({ ...p, roomName: event.target.value })))}
            placeholder="e.g. dr-cheung-nov27"
            required
          />
        </label>
        <label className="invite-field">
          <span>Expires in</span>
          <select
            value={formData.expiresInHours}
            onChange={(event) => setFormData((p) => ({ ...p, expiresInHours: Number(event.target.value) }))}
          >
            <option value={1}>1 hour</option>
            <option value={6}>6 hours</option>
            <option value={12}>12 hours</option>
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
            <option value={72}>3 days</option>
            <option value={168}>1 week</option>
          </select>
        </label>
        <label className="invite-field invite-field--narrow">
          <span>Waiting limit</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={formData.maxPatients || 10}
            onChange={(event) => setFormData((p) => ({ ...p, maxPatients: Number(event.target.value) }))}
            aria-describedby="waiting-limit-help"
          />
        </label>
      </div>
      <p id="waiting-limit-help" className="sr-only">Maximum patients waiting at once for this link.</p>

      <div className="invite-field">
        <span id="allowlist-label">Patients who can join directly <em>(optional)</em></span>
        <div className="chip-input" onClick={(event) => (event.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>
          {emails.map((email) => (
            <span key={email} className="chip">
              {email}
              <button type="button" aria-label={`Remove ${email}`} onClick={() => setEmails((current) => current.filter((item) => item !== email))}>×</button>
            </span>
          ))}
          <input
            type="email"
            value={draftEmail}
            onChange={(event) => setDraftEmail(event.target.value)}
            onKeyDown={handleEmailKeyDown}
            onPaste={handleEmailPaste}
            onBlur={() => draftEmail.trim() && commitEmails(draftEmail)}
            placeholder={emails.length ? 'Add another email' : 'patient@example.com — press Enter to add'}
            aria-labelledby="allowlist-label"
            aria-describedby="allowlist-help"
          />
        </div>
        {/* States both branches of the rule: a setting whose effect on everyone
            else is invisible is the one doctors misread. */}
        <details id="allowlist-help" className="invite-help">
          <summary>Verified accounts on this list skip the queue; everyone else waits for you.</summary>
          A patient who opens the link with a <strong>registered, provider-verified account matching one of these
          addresses</strong> joins immediately. <strong>Everyone else — including anyone the link is forwarded to,
          or anyone who only types an address — waits for you to admit them.</strong> Leave empty to review every patient.
        </details>
      </div>

      {error && <div role="alert" className="invite-error">{error}</div>}

      <div className="invite-footer">
        <p aria-live="polite" className="invite-preview">
          <strong>Access preview:</strong> {describeInvitationAudience(allowlist.length)} Expires after {expiryLabel};
          up to {formData.maxPatients || 10} waiting at once.
        </p>
        <button type="submit" disabled={isCreating} className="invite-submit">
          {isCreating ? 'Creating…' : 'Create invitation link'}
        </button>
      </div>

      <style jsx>{`
        .invite-form { display: grid; gap: 0.875rem; }
        .invite-row {
          display: grid;
          grid-template-columns: minmax(12rem, 1fr) minmax(8rem, 10rem) minmax(6rem, 7.5rem);
          gap: 0.75rem;
          align-items: end;
        }
        .invite-field { display: grid; gap: 0.3rem; font-size: 0.8125rem; font-weight: 600; color: #374151; }
        .invite-field em { font-weight: 400; color: #6b7280; font-style: normal; }
        .invite-field input, .invite-field select {
          width: 100%;
          padding: 0.55rem 0.7rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 0.9375rem;
          font-weight: 400;
          background: #fff;
        }
        .chip-input {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
          align-items: center;
          padding: 0.3rem 0.4rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          background: #fff;
          cursor: text;
        }
        .chip-input:focus-within { border-color: #14b8a6; box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.2); }
        .chip-input input { flex: 1; min-width: 12rem; border: 0; padding: 0.3rem; font-size: 0.9375rem; font-weight: 400; outline: none; }
        .chip {
          display: inline-flex; align-items: center; gap: 0.25rem;
          background: #ccfbf1; color: #115e59; border-radius: 999px;
          padding: 0.15rem 0.3rem 0.15rem 0.65rem; font-size: 0.8125rem; font-weight: 500;
        }
        .chip button { border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 1rem; line-height: 1; padding: 0 0.25rem; }
        .invite-help { font-size: 0.75rem; color: #6b7280; font-weight: 400; line-height: 1.5; }
        .invite-help summary { cursor: pointer; }
        .invite-error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.8125rem; }
        .invite-footer { display: flex; gap: 1rem; align-items: center; justify-content: space-between; flex-wrap: wrap; }
        .invite-preview { margin: 0; flex: 1 1 22rem; font-size: 0.8125rem; color: #1e3a8a; }
        .invite-submit {
          flex: none; padding: 0.6rem 1.25rem; border: 0; border-radius: 0.5rem;
          background: #0f766e; color: #fff; font-weight: 600; font-size: 0.9375rem; cursor: pointer;
        }
        .invite-submit:disabled { background: #9ca3af; cursor: not-allowed; }
        .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
        @media (max-width: 640px) {
          .invite-row { grid-template-columns: 1fr 1fr; }
          .invite-field--room { grid-column: 1 / -1; }
          .invite-submit { width: 100%; }
        }
      `}</style>
    </form>
  );
}

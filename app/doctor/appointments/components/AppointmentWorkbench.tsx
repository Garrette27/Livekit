'use client';

import React, { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { authenticatedFetch } from '@/lib/auth/authenticated-fetch';
import { appointmentRoomName, type AppointmentCancellationReason } from '@/lib/appointments/appointment-policy';
import type { AppointmentRecord } from '@/lib/services/appointments/appointment-service';

const EMPTY_DRAFT = { patientName: '', patientEmail: '', localStart: '', durationMinutes: 30, displayTimeZone: 'Asia/Manila' };
type Feedback = { error: boolean; text: string } | null;
const REASON_LABEL: Record<AppointmentCancellationReason, string> = {
  'patient-request': 'Patient request',
  'clinic-request': 'Clinic request',
  rescheduled: 'Rebooked as a new appointment',
  other: 'Other',
};

/** Display/edit a stored instant in its explicit booking zone, never the device's zone. */
function localInput(instant: string, zone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * A doctor-owned booking workbench. Server responses are committed facts; drafts
 * retain the reviewed version until the doctor explicitly reloads an appointment.
 * Scheduling commands never request an invitation, media token or transcription;
 * "Prepare invitation" only opens the invitation workbench with a suggested
 * room, where the doctor issues the invitation through its normal server checks.
 */
export default function AppointmentWorkbench({ doctorUserId }: { doctorUserId: string }) {
  const [records, setRecords] = useState<AppointmentRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editing, setEditing] = useState<AppointmentRecord | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; version: number } | null>(null);
  const [cancelReason, setCancelReason] = useState<AppointmentCancellationReason>('patient-request');
  const createId = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const alive = useRef(true);
  const readRevision = useRef(0);

  const load = useCallback(async (cursor?: string) => {
    const revision = ++readRevision.current;
    setLoading(true);
    try {
      const response = await authenticatedFetch(`/api/doctor/appointments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, {}, doctorUserId);
      const body = await response.json();
      if (!alive.current || revision !== readRevision.current) return;
      if (!response.ok || !body.success) {
        if (body.code === 'scheduling_disabled') setEnabled(false);
        else setFeedback({ error: true, text: body.error || 'Could not load appointments. Please retry.' });
        return;
      }
      setEnabled(true);
      setCancelTarget(null);
      setRecords((current) => cursor ? [...new Map([...current, ...body.appointments].map((item: AppointmentRecord) => [item.id, item])).values()] : body.appointments);
      setNextCursor(body.nextCursor);
    } catch { if (alive.current && revision === readRevision.current) setFeedback({ error: true, text: 'Could not load appointments. Please retry.' }); }
    finally { if (alive.current && revision === readRevision.current) setLoading(false); }
  }, [doctorUserId]);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; readRevision.current++; };
  }, [load]);

  const resetDraft = () => {
    setEditing(null);
    setDraft((current) => ({ ...EMPTY_DRAFT, displayTimeZone: current.displayTimeZone }));
    createId.current = null;
  };

  const send = async (command: Record<string, unknown>) => {
    // Earlier list snapshots must not overwrite the result of this command.
    readRevision.current++;
    setLoading(false);
    setBusy(String(command.id));
    setFeedback(null);
    try {
      const response = await authenticatedFetch('/api/doctor/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) }, doctorUserId);
      const body = await response.json();
      if (!alive.current) return;
      if (body.code === 'scheduling_disabled') {
        setEnabled(false);
        setRecords([]);
        setCancelTarget(null);
        return;
      }
      if (!response.ok || !body.success) {
        setFeedback({ error: true, text: body.error || 'The change was not confirmed. Refresh the list before retrying.' });
        if (response.status === 409) await load();
        return;
      }
      if (command.action !== 'cancel' || editing?.id === command.id) resetDraft();
      setCancelTarget(null);
      const action = command.action === 'create' ? 'booked' : command.action === 'cancel' ? 'cancelled' : 'rescheduled';
      const revoked = Number(body.revokedInvitationCount) || 0;
      const cancelText = revoked > 0
        ? `Appointment cancelled. ${revoked} active invitation link${revoked === 1 ? '' : 's'} for this visit ${revoked === 1 ? 'was' : 'were'} revoked; anyone waiting was removed. Clinical records are unchanged.`
        : 'Appointment cancelled. No active invitation link existed for this visit. Clinical records are unchanged.';
      setFeedback({ error: false, text: body.replayed ? 'Original booking request confirmed. The current appointment is shown below.' : command.action === 'cancel' ? cancelText : `Appointment ${action}. Room admission and clinical records are unchanged.` });
      await load();
    } catch { if (alive.current) setFeedback({ error: true, text: 'The change could not be confirmed. Refresh the list before retrying. Retrying the same booking request will not create a duplicate.' }); }
    finally { if (alive.current) setBusy(null); }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!editing && !createId.current) createId.current = crypto.randomUUID();
    void send({ action: editing ? 'reschedule' : 'create', id: editing?.id || createId.current, ...draft, ...(editing ? { expectedVersion: editing.version } : {}) });
  };
  const edit = (record: AppointmentRecord) => {
    setEditing(record);
    setDraft({ patientName: record.patientName, patientEmail: record.patientEmail || '', localStart: localInput(record.startsAt, record.displayTimeZone), durationMinutes: Math.round((Date.parse(record.endsAt) - Date.parse(record.startsAt)) / 60_000), displayTimeZone: record.displayTimeZone });
    setFeedback(null);
    setCancelTarget(null);
    formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    formRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  };

  if (enabled === false) return <section className="appointment-card"><h1>Appointments</h1><p>Appointments are not enabled in this deployment.</p><a href="/doctor/invitations">Return to invitations</a></section>;
  if (enabled === null) return <section><p role={feedback?.error ? 'alert' : 'status'}>{feedback?.text || 'Checking appointment availability…'}</p>{feedback && <button onClick={() => void load()} disabled={loading}>Retry loading appointments</button>}</section>;

  return (
    <div className="appointments-workbench">
      <section className="appointment-card">
        <h1>{editing ? 'Reschedule appointment' : 'Book an appointment'}</h1>
        <p className="muted">Plan a visit for your own patient. Booking does not grant room access or start a consultation. When it is time, choose Prepare invitation to issue a secure link for that visit&apos;s room.</p>
        <form onSubmit={submit} ref={formRef}>
          <fieldset disabled={busy !== null}>
            <legend className="sr-only">Appointment details</legend>
            <div className="booking-fields">
              <label>Patient name<input required maxLength={100} value={draft.patientName} onChange={(e) => setDraft({ ...draft, patientName: e.target.value })} /></label>
              <label>Contact email (optional)<input type="email" maxLength={320} value={draft.patientEmail} onChange={(e) => setDraft({ ...draft, patientEmail: e.target.value })} /></label>
              <label>Start date and time<input type="datetime-local" required value={draft.localStart} onChange={(e) => setDraft({ ...draft, localStart: e.target.value })} /></label>
              <label>Duration (minutes)<input type="number" min={15} max={120} step={1} required value={draft.durationMinutes} onChange={(e) => setDraft({ ...draft, durationMinutes: Number(e.target.value) })} /></label>
              <label className="zone-field">Time zone (IANA)<input list="booking-zones" required maxLength={100} value={draft.displayTimeZone} onChange={(e) => setDraft({ ...draft, displayTimeZone: e.target.value })} /></label>
            </div>
            <datalist id="booking-zones"><option value="Asia/Manila" /><option value="Asia/Singapore" /><option value="UTC" /><option value="America/New_York" /><option value="Europe/London" /></datalist>
            <p className="muted">Use the named timezone, not your device clock. Choose a future time within 180 days. Contact details are unverified scheduling information, not permission to skip the waiting room. No reminders are sent.</p>
            <div className="booking-actions"><button className="primary" type="submit">{busy ? 'Saving…' : editing ? 'Save reschedule' : 'Book appointment'}</button>{editing && <button type="button" onClick={resetDraft}>Discard reschedule</button>}</div>
          </fieldset>
        </form>
      </section>
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'feedback-error' : 'feedback-success'}>{feedback.text}</p>}
      <section className="appointment-card" aria-labelledby="booking-list-heading">
        <div className="list-heading"><h2 id="booking-list-heading">Your appointments</h2><button onClick={() => void load()} disabled={loading || !!busy}>Refresh list</button></div>
        <p className="muted">Upcoming bookings and the past 30 days. Cancelled records are kept. Each appointment shows its own timezone.</p>
        {loading && <p role="status">Loading appointments…</p>}
        {!records.length && !loading && <p>No appointments in this window.</p>}
        <ul className="booking-list">{records.map((record) => {
          const date = new Intl.DateTimeFormat(undefined, { timeZone: record.displayTimeZone, dateStyle: 'medium', timeStyle: 'short' });
          return <li key={record.id}>
            <div><h3>{record.patientName}</h3><p className={record.status === 'cancelled' ? 'struck' : undefined}>{date.format(new Date(record.startsAt))} – {date.format(new Date(record.endsAt))}</p><p className="muted">{record.displayTimeZone} · Room {appointmentRoomName(record.id)} · <span className={record.status === 'cancelled' ? 'status-badge cancelled' : 'status-badge booked'}>{record.status === 'cancelled' ? 'Cancelled' : 'Booked'}</span></p>{record.status === 'cancelled' && <p className="cancel-meta">{record.cancellation ? <>Cancelled {new Intl.DateTimeFormat(undefined, { timeZone: record.displayTimeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(record.cancellation.at))} · {REASON_LABEL[record.cancellation.reason]} · {record.cancellation.revokedInvitationCount == null ? 'invitation revocation not recorded' : `${record.cancellation.revokedInvitationCount} invitation link${record.cancellation.revokedInvitationCount === 1 ? '' : 's'} revoked`}</> : 'Cancelled before cancellation details were recorded.'}</p>}{record.patientEmail && <details><summary>Contact details (unverified)</summary><p>{record.patientEmail}</p></details>}</div>
            {record.status === 'booked' && <div className="booking-actions">
              {Date.parse(record.endsAt) > Date.now() && <a className="link-button" href={`/doctor/invitations?room=${appointmentRoomName(record.id)}`} aria-label={`Prepare invitation for ${record.patientName}`}>Prepare invitation</a>}
              <button disabled={!!busy} aria-label={`Reschedule appointment for ${record.patientName}`} onClick={() => edit(record)}>Reschedule</button>
              {cancelTarget?.id === record.id && cancelTarget.version === record.version ? <div className="cancel-confirm" role="group" aria-label={`Cancel appointment for ${record.patientName}`}><label className="reason">Reason<select value={cancelReason} onChange={(e) => setCancelReason(e.target.value as AppointmentCancellationReason)}>{(Object.keys(REASON_LABEL) as AppointmentCancellationReason[]).map((reason) => <option key={reason} value={reason}>{REASON_LABEL[reason]}</option>)}</select></label><p className="muted">This also revokes any active invitation link for room {appointmentRoomName(record.id)} and removes anyone waiting through it.</p><div className="booking-actions"><button disabled={!!busy} className="danger" onClick={() => void send({ action: 'cancel', id: record.id, expectedVersion: cancelTarget.version, cancellationReason: cancelReason })}>Confirm cancellation</button><button onClick={() => setCancelTarget(null)} disabled={!!busy}>Keep appointment</button></div></div> : <button className="danger" disabled={!!busy} aria-label={`Cancel appointment for ${record.patientName}`} onClick={() => setCancelTarget({ id: record.id, version: record.version })}>Cancel appointment</button>}
            </div>}
          </li>;
        })}</ul>
        {nextCursor && <button disabled={loading || !!busy} onClick={() => void load(nextCursor)}>Show more appointments</button>}
      </section>
      <style jsx>{`
        .appointments-workbench{display:grid;gap:1.25rem;min-width:0;color:#153530}
        .appointment-card{background:white;border:1px solid #dce5e3;border-radius:.875rem;padding:clamp(1rem,3vw,1.75rem);min-width:0;overflow-wrap:anywhere}
        h1,h2,h3{margin:0 0 .75rem} h1{font-size:1.5rem} h2{font-size:1.25rem} h3{font-size:1.05rem}
        p{line-height:1.55;margin:.5rem 0} .muted{color:#526762;font-size:.875rem}
        fieldset{border:0;padding:0;min-width:0;margin:1rem 0 0}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
        .booking-fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1rem}.zone-field{grid-column:1/-1}
        label{display:grid;gap:.4rem;min-width:0;font-size:.9rem;font-weight:600}input{min-width:0;width:100%;height:2.9rem;padding:.5rem;border:1px solid #b7cac4;border-radius:.4rem;font:inherit;font-size:1rem;background:white;color:#153530}
        .booking-actions,.list-heading{display:flex;align-items:center;flex-wrap:wrap;gap:.65rem}.list-heading{justify-content:space-between}
        button{font:inherit;min-height:2.75rem;max-width:100%;padding:.55rem .85rem;border:1px solid #b7cac4;border-radius:.4rem;background:white;color:#17594f;cursor:pointer;overflow-wrap:anywhere}button:hover{background:#edf8f4}button:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid #14b8a6;outline-offset:2px}button:disabled{opacity:.6;cursor:wait}.primary{background:#0f766e;color:white}.primary:hover{background:#115e59}.danger{color:#a52828;border-color:#e9b4b4}.status-badge{display:inline-block;padding:.05rem .5rem;border-radius:999px;font-weight:600}.status-badge.booked{background:#dcfce7;color:#166534}.status-badge.cancelled{background:#fee2e2;color:#991b1b}.cancel-meta{color:#7f1d1d;font-size:.85rem;background:#fef2f2;border-radius:.4rem;padding:.4rem .6rem}.struck{text-decoration:line-through;color:#6b7280}.cancel-confirm{display:grid;gap:.5rem;width:100%}.reason{max-width:20rem}select{min-width:0;width:100%;height:2.75rem;padding:.4rem;border:1px solid #b7cac4;border-radius:.4rem;font:inherit;background:white;color:#153530}.link-button{display:inline-flex;align-items:center;min-height:2.75rem;padding:.55rem .85rem;border-radius:.4rem;background:#0f766e;color:white;text-decoration:none;font-weight:600}.link-button:hover{background:#115e59}.link-button:focus-visible{outline:3px solid #14b8a6;outline-offset:2px}
        .feedback-error,.feedback-success{padding:.85rem;border-radius:.5rem;overflow-wrap:anywhere;line-height:1.5}.feedback-error{color:#8f2020;background:#fff1f1}.feedback-success{color:#115e43;background:#edf9f2}
        .booking-list{list-style:none;padding:0;margin:1rem 0;display:grid;gap:.8rem}.booking-list li{border:1px solid #dce5e3;border-radius:.6rem;padding:1rem;display:grid;gap:.75rem;min-width:0}summary{cursor:pointer;color:#17594f;min-height:2rem}
        @media(max-width:600px){.booking-fields{grid-template-columns:minmax(0,1fr)}.booking-actions{align-items:stretch}.booking-actions button{flex:1 1 auto}}
      `}</style>
    </div>
  );
}

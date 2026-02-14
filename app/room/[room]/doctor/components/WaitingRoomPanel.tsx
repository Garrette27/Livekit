'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWaitingQueue } from '@/hooks/useWaitingQueue';
import { useToast } from '@/components/ui/feedback/ToastProvider';
import type { WaitingPatient } from '@/lib/types';

interface WaitingRoomPanelProps {
  roomName: string;
  doctorUserId?: string;
  autoRefresh?: boolean;
  pollIntervalMs?: number;
  showRefreshButton?: boolean;
  showAdmitControl?: boolean;
  showRejectControl?: boolean;
  showRemoveControl?: boolean;
}

function toDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'object' && value !== null) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate();
    }
  }

  const parsed = new Date(value as string | number | Date);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function getDisplayName(patient: WaitingPatient): string {
  if (patient.patientName && patient.patientName !== 'Anonymous Patient') {
    return patient.patientName;
  }
  return patient.patientEmail || 'Anonymous Patient';
}

export default function WaitingRoomPanel({
  roomName,
  doctorUserId,
  autoRefresh = true,
  pollIntervalMs = 15_000,
  showRefreshButton = false,
  showAdmitControl = true,
  showRejectControl = true,
  showRemoveControl = true,
}: WaitingRoomPanelProps) {
  const { showToast } = useToast();
  const [pendingRejectId, setPendingRejectId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const {
    waitingPatients,
    loading,
    error,
    admittingId,
    rejectingId,
    refresh,
    admitPatient,
    rejectPatient,
  } = useWaitingQueue({
    roomName,
    doctorUserId,
    statuses: ['waiting', 'admitted'],
    autoRefresh,
    pollIntervalMs,
  });

  const pollSeconds = useMemo(() => Math.max(1, Math.round(pollIntervalMs / 1000)), [pollIntervalMs]);
  const waitingOnly = useMemo(
    () => waitingPatients.filter((patient) => patient.status === 'waiting'),
    [waitingPatients]
  );
  const admittedOnly = useMemo(
    () => waitingPatients.filter((patient) => patient.status === 'admitted'),
    [waitingPatients]
  );

  useEffect(() => {
    if (!pendingRejectId) {
      return;
    }

    const timer = window.setTimeout(() => setPendingRejectId(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pendingRejectId]);

  useEffect(() => {
    if (!pendingRemoveId) {
      return;
    }

    const timer = window.setTimeout(() => setPendingRemoveId(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pendingRemoveId]);

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: '#ffffff',
        borderRadius: '0.5rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: '#111827',
            margin: 0,
          }}
        >
          Queue ({waitingOnly.length}) | In Room ({admittedOnly.length})
        </h3>

        {showRefreshButton && (
          <button
            onClick={() => void refresh(true)}
            disabled={loading}
            style={{
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.375rem',
            padding: '0.75rem',
            marginBottom: '1rem',
            color: '#dc2626',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {waitingOnly.length === 0 && admittedOnly.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '2rem 1rem',
            color: '#6b7280',
            fontSize: '0.875rem',
          }}
        >
          <p>No patients in queue or consultation.</p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Patients with waiting room enabled invitations will appear here.
          </p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: admittedOnly.length > 0 ? '1rem' : 0 }}>
            <p
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '0.75rem',
                color: '#6b7280',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Waiting Queue
            </p>
            {waitingOnly.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af' }}>No one waiting right now.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {waitingOnly.map((patient) => {
                  const joinedAt = toDate(patient.joinedAt);
                  const waitTimeMinutes = joinedAt
                    ? Math.floor((Date.now() - joinedAt.getTime()) / 1000 / 60)
                    : null;
                  const displayName = getDisplayName(patient);

                  return (
                    <div
                      key={patient.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        padding: '0.75rem',
                        backgroundColor: '#f9fafb',
                      }}
                    >
                      <div style={{ marginBottom: '0.5rem' }}>
                        <p
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#111827',
                            margin: '0 0 0.25rem 0',
                          }}
                        >
                          {displayName}
                        </p>
                        {patient.patientEmail && (
                          <p
                            style={{
                              fontSize: '0.75rem',
                              color: '#6b7280',
                              margin: 0,
                            }}
                          >
                            {patient.patientEmail}
                          </p>
                        )}
                        <p
                          style={{
                            fontSize: '0.7rem',
                            color: '#9ca3af',
                            margin: '0.25rem 0 0 0',
                          }}
                        >
                          {waitTimeMinutes === null
                            ? 'Waiting time unavailable'
                            : `Waiting for ${waitTimeMinutes} minute${waitTimeMinutes !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {showAdmitControl && (
                          <button
                            onClick={async () => {
                              const admitted = await admitPatient(patient.id);
                              if (admitted) {
                                showToast({
                                  kind: 'success',
                                  title: 'Patient admitted',
                                  message: `${displayName} can now join the consultation room.`,
                                });
                              }
                            }}
                            disabled={admittingId === patient.id}
                            style={{
                              backgroundColor: admittingId === patient.id ? '#9ca3af' : '#059669',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.375rem',
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              cursor: admittingId === patient.id ? 'not-allowed' : 'pointer',
                              flex: 1,
                            }}
                          >
                            {admittingId === patient.id ? 'Admitting...' : 'Admit'}
                          </button>
                        )}
                        {showRejectControl && (
                          <button
                            onClick={async () => {
                              if (pendingRejectId !== patient.id) {
                                setPendingRejectId(patient.id);
                                showToast({
                                  kind: 'info',
                                  title: 'Confirm reject',
                                  message: 'Click Reject again within 5 seconds.',
                                });
                                return;
                              }

                              const rejected = await rejectPatient(patient.id);
                              setPendingRejectId(null);
                              if (rejected) {
                                showToast({
                                  kind: 'success',
                                  title: 'Patient rejected',
                                  message: `${displayName} was removed from the waiting queue.`,
                                });
                              }
                            }}
                            disabled={rejectingId === patient.id}
                            style={{
                              backgroundColor: rejectingId === patient.id ? '#9ca3af' : '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.375rem',
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              cursor: rejectingId === patient.id ? 'not-allowed' : 'pointer',
                              flex: 1,
                            }}
                          >
                            {rejectingId === patient.id
                              ? 'Rejecting...'
                              : pendingRejectId === patient.id
                                ? 'Confirm Reject'
                                : 'Reject'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '0.75rem',
                color: '#6b7280',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              In Consultation Room
            </p>
            {admittedOnly.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af' }}>No admitted patient currently in room.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {admittedOnly.map((patient) => {
                  const admittedAt = toDate(patient.admittedAt || patient.joinedAt);
                  const admittedMinutes = admittedAt
                    ? Math.max(0, Math.floor((Date.now() - admittedAt.getTime()) / 1000 / 60))
                    : null;
                  const displayName = getDisplayName(patient);

                  return (
                    <div
                      key={patient.id}
                      style={{
                        border: '1px solid #d1fae5',
                        borderRadius: '0.5rem',
                        padding: '0.75rem',
                        backgroundColor: '#ecfdf5',
                      }}
                    >
                      <div style={{ marginBottom: '0.5rem' }}>
                        <p
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#065f46',
                            margin: '0 0 0.25rem 0',
                          }}
                        >
                          {displayName}
                        </p>
                        {patient.patientEmail && (
                          <p style={{ fontSize: '0.75rem', color: '#047857', margin: 0 }}>{patient.patientEmail}</p>
                        )}
                        <p style={{ fontSize: '0.7rem', color: '#059669', margin: '0.25rem 0 0 0' }}>
                          {admittedMinutes === null
                            ? 'In-room duration unavailable'
                            : `In room for ${admittedMinutes} minute${admittedMinutes !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                      {showRemoveControl && (
                        <button
                          onClick={async () => {
                            if (pendingRemoveId !== patient.id) {
                              setPendingRemoveId(patient.id);
                              showToast({
                                kind: 'info',
                                title: 'Confirm removal',
                                message: 'Click Remove again within 5 seconds.',
                              });
                              return;
                            }

                            const removed = await rejectPatient(patient.id);
                            setPendingRemoveId(null);
                            if (removed) {
                              showToast({
                                kind: 'success',
                                title: 'Patient removed',
                                message: `${displayName} was removed from the consultation room.`,
                              });
                            }
                          }}
                          disabled={rejectingId === patient.id}
                          style={{
                            backgroundColor: rejectingId === patient.id ? '#9ca3af' : '#b91c1c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            cursor: rejectingId === patient.id ? 'not-allowed' : 'pointer',
                            width: '100%',
                          }}
                        >
                          {rejectingId === patient.id
                            ? 'Removing...'
                            : pendingRemoveId === patient.id
                              ? 'Confirm Remove'
                              : 'Remove from Room'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <div
        style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '0.375rem',
          fontSize: '0.7rem',
          color: '#1e40af',
        }}
      >
        <p style={{ margin: 0, fontWeight: '500' }}>How it works:</p>
        <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem' }}>
          <li>Patients join the waiting room automatically.</li>
          <li>Use `Admit` to move a patient into consultation.</li>
          <li>Use `Reject` or `Remove from Room` for moderation.</li>
          <li>
            {autoRefresh
              ? `The list refreshes automatically every ${pollSeconds} second${pollSeconds === 1 ? '' : 's'}.`
              : 'Automatic refresh is disabled for this panel.'}
          </li>
        </ul>
      </div>
    </div>
  );
}

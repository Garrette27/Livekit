'use client';

import { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { Invitation } from '@/lib/types';
import { useWaitingQueue } from '@/hooks/useWaitingQueue';
import { useToast } from '@/components/ui/feedback/ToastProvider';

interface WaitingPatientsListProps {
  user: User;
  invitations: Invitation[];
  selectedInvitationId: string | null;
  onCountUpdate?: (invitationId: string, count: number) => void;
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

function isActiveInvitation(invitation: Invitation, nowMs: number): boolean {
  if (invitation.status !== 'active') {
    return false;
  }

  const expiresAtDate = toDate(invitation.expiresAt);
  if (!expiresAtDate) {
    return true;
  }

  return expiresAtDate.getTime() > nowMs;
}

export default function WaitingPatientsList({
  user,
  invitations,
  selectedInvitationId,
  onCountUpdate,
}: WaitingPatientsListProps) {
  const { showToast } = useToast();
  const [pendingRejectId, setPendingRejectId] = useState<string | null>(null);
  const activeInvitations = useMemo(
    () =>
      invitations.filter(
        (invitation) =>
          isActiveInvitation(invitation, Date.now()) &&
          invitation.waitingRoomEnabled === true &&
          invitation.createdBy === user.uid
      ),
    [invitations, user.uid]
  );

  const activeInvitationIds = useMemo(() => activeInvitations.map((invitation) => invitation.id), [activeInvitations]);

  const {
    waitingPatients,
    waitingPatientCounts,
    loading,
    error,
    admittingId,
    rejectingId,
    admitPatient,
    rejectPatient,
  } = useWaitingQueue({
    doctorUserId: user.uid,
    invitationIds: activeInvitationIds,
    selectedInvitationId,
    statuses: ['waiting', 'admitted'],
    autoRefresh: true,
    pollIntervalMs: 5000,
  });

  const waitingOnly = useMemo(
    () => waitingPatients.filter((patient) => patient.status === 'waiting'),
    [waitingPatients]
  );
  const admittedOnly = useMemo(
    () => waitingPatients.filter((patient) => patient.status === 'admitted'),
    [waitingPatients]
  );

  useEffect(() => {
    if (!onCountUpdate) {
      return;
    }

    activeInvitations.forEach((invitation) => {
      onCountUpdate(invitation.id, waitingPatientCounts[invitation.id] || 0);
    });
  }, [activeInvitations, onCountUpdate, waitingPatientCounts]);

  useEffect(() => {
    if (!pendingRejectId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPendingRejectId(null);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [pendingRejectId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div
          style={{
            width: '2rem',
            height: '2rem',
            border: '2px solid #dbeafe',
            borderTop: '2px solid #2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem',
          }}
        ></div>
        <p style={{ color: '#6B7280' }}>Loading waiting patients...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#dc2626' }}>
        <p>Error: {error}</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: '#6B7280' }}>
          Check browser console for details.
        </p>
      </div>
    );
  }

  if (waitingOnly.length === 0 && admittedOnly.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
        <p>{selectedInvitationId ? 'No patients in queue for this invitation.' : 'No patients in queue.'}</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          {selectedInvitationId
            ? 'Patients will appear here when they join using this invitation link.'
            : 'Click on an invitation card to view its waiting patients, or they will appear here when they join.'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
      <div style={{ marginBottom: '1rem' }}>
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
          Waiting Queue ({waitingOnly.length})
        </p>
        {waitingOnly.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af' }}>No one waiting right now.</p>
        ) : (
          waitingOnly.map((patient) => {
            const joinedAt = toDate(patient.joinedAt);
            const waitTime = joinedAt ? Math.floor((Date.now() - joinedAt.getTime()) / 1000 / 60) : null;
            const displayName =
              patient.patientName && patient.patientName !== 'Anonymous Patient'
                ? patient.patientName
                : patient.patientEmail || 'Anonymous Patient';

            return (
              <div
                key={patient.id}
                style={{
                  border: '1px solid #E5E7EB',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  marginBottom: '1rem',
                  backgroundColor: '#F9FAFB',
                }}
              >
                <div style={{ marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '0.25rem' }}>
                    Room: {patient.roomName}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>
                    <strong>Email:</strong> {patient.patientEmail || 'Unknown'}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>
                    <strong>Name:</strong> {displayName}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '0.25rem' }}>
                    <strong>Joined:</strong> {joinedAt ? joinedAt.toLocaleString() : 'Unknown'}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                    {waitTime === null
                      ? 'Waiting time unavailable'
                      : `Waiting for ${waitTime} minute${waitTime !== 1 ? 's' : ''}`}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={async () => {
                      const admitted = await admitPatient(patient.id, patient.roomName);
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
                      padding: '0.5rem 1rem',
                      borderRadius: '0.375rem',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      cursor: admittingId === patient.id ? 'not-allowed' : 'pointer',
                      flex: 1,
                    }}
                  >
                    {admittingId === patient.id ? 'Admitting...' : 'Admit'}
                  </button>
                  <button
                    onClick={async () => {
                      if (pendingRejectId !== patient.id) {
                        setPendingRejectId(patient.id);
                        showToast({
                          kind: 'info',
                          title: 'Confirm removal',
                          message: 'Click Reject again within 5 seconds to remove this patient.',
                        });
                        return;
                      }

                      const rejected = await rejectPatient(patient.id);
                      setPendingRejectId(null);
                      if (rejected) {
                        showToast({
                          kind: 'success',
                          title: 'Patient removed',
                          message: `${displayName} was removed from the waiting room.`,
                        });
                      }
                    }}
                    disabled={rejectingId === patient.id}
                    style={{
                      backgroundColor: rejectingId === patient.id ? '#9ca3af' : '#dc2626',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.375rem',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      cursor: rejectingId === patient.id ? 'not-allowed' : 'pointer',
                      flex: 1,
                    }}
                  >
                    {rejectingId === patient.id
                      ? 'Removing...'
                      : pendingRejectId === patient.id
                        ? 'Confirm Reject'
                        : 'Reject'}
                  </button>
                </div>
              </div>
            );
          })
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
          In Consultation Room ({admittedOnly.length})
        </p>
        {admittedOnly.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af' }}>No admitted patient currently in room.</p>
        ) : (
          admittedOnly.map((patient) => {
            const admittedAt = toDate(patient.admittedAt || patient.joinedAt);
            const admittedMinutes = admittedAt
              ? Math.max(0, Math.floor((Date.now() - admittedAt.getTime()) / 1000 / 60))
              : null;
            const displayName =
              patient.patientName && patient.patientName !== 'Anonymous Patient'
                ? patient.patientName
                : patient.patientEmail || 'Anonymous Patient';

            return (
              <div
                key={patient.id}
                style={{
                  border: '1px solid #d1fae5',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  marginBottom: '1rem',
                  backgroundColor: '#ecfdf5',
                }}
              >
                <div style={{ marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#065f46', marginBottom: '0.25rem' }}>
                    Room: {patient.roomName}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#047857', marginBottom: '0.25rem' }}>
                    <strong>Email:</strong> {patient.patientEmail || 'Unknown'}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#047857', marginBottom: '0.25rem' }}>
                    <strong>Name:</strong> {displayName}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#047857', marginBottom: '0.25rem' }}>
                    <strong>Admitted:</strong> {admittedAt ? admittedAt.toLocaleString() : 'Unknown'}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.5rem' }}>
                    {admittedMinutes === null
                      ? 'In-room duration unavailable'
                      : `In room for ${admittedMinutes} minute${admittedMinutes !== 1 ? 's' : ''}`}
                  </p>
                </div>

                <button
                  onClick={async () => {
                    if (pendingRejectId !== patient.id) {
                      setPendingRejectId(patient.id);
                      showToast({
                        kind: 'info',
                        title: 'Confirm removal',
                        message: 'Click Remove again within 5 seconds to remove this patient.',
                      });
                      return;
                    }

                    const removed = await rejectPatient(patient.id);
                    setPendingRejectId(null);
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
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    cursor: rejectingId === patient.id ? 'not-allowed' : 'pointer',
                    width: '100%',
                  }}
                >
                  {rejectingId === patient.id
                    ? 'Removing...'
                    : pendingRejectId === patient.id
                      ? 'Confirm Remove'
                      : 'Remove from Room'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

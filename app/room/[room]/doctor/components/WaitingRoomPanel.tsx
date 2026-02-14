'use client';

import { useMemo } from 'react';
import { useWaitingQueue } from '@/hooks/useWaitingQueue';
import { useToast } from '@/components/ui/feedback/ToastProvider';

interface WaitingRoomPanelProps {
  roomName: string;
  doctorUserId?: string;
  autoRefresh?: boolean;
  pollIntervalMs?: number;
  showRefreshButton?: boolean;
  showAdmitControl?: boolean;
}

export default function WaitingRoomPanel({
  roomName,
  doctorUserId,
  autoRefresh = true,
  pollIntervalMs = 15_000,
  showRefreshButton = false,
  showAdmitControl = true,
}: WaitingRoomPanelProps) {
  const { showToast } = useToast();
  const {
    waitingPatients,
    loading,
    error,
    admittingId,
    refresh,
    admitPatient,
  } = useWaitingQueue({
    roomName,
    doctorUserId,
    autoRefresh,
    pollIntervalMs,
  });

  const pollSeconds = useMemo(() => Math.max(1, Math.round(pollIntervalMs / 1000)), [pollIntervalMs]);

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
          Waiting Room ({waitingPatients.length})
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

      {waitingPatients.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '2rem 1rem',
            color: '#6b7280',
            fontSize: '0.875rem',
          }}
        >
          <p>No patients waiting</p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Patients with waiting room enabled invitations will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {waitingPatients.map((patient) => {
            const joinedAt = patient.joinedAt?.toDate ? patient.joinedAt.toDate() : new Date(patient.joinedAt);
            const waitTimeMinutes = Math.floor((Date.now() - joinedAt.getTime()) / 1000 / 60);
            const displayName =
              patient.patientName && patient.patientName !== 'Anonymous Patient'
                ? patient.patientName
                : patient.patientEmail || 'Anonymous Patient';

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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: showAdmitControl ? 'space-between' : 'flex-start',
                    alignItems: 'flex-start',
                    marginBottom: '0.5rem',
                  }}
                >
                  <div>
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
                      Waiting for {waitTimeMinutes} minute{waitTimeMinutes !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {showAdmitControl && (
                    <button
                      onClick={async () => {
                        const admitted = await admitPatient(patient.id);
                        if (admitted) {
                          showToast({
                            kind: 'success',
                            title: 'Patient admitted',
                            message: `${displayName} can now join the main room.`,
                          });
                        }
                      }}
                      disabled={admittingId === patient.id}
                      style={{
                        backgroundColor: admittingId === patient.id ? '#9ca3af' : '#059669',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        padding: '0.5rem 1rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        cursor: admittingId === patient.id ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {admittingId === patient.id ? 'Admitting...' : 'Admit'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
          <li>
            {showAdmitControl
              ? 'Click Admit to allow a patient into the consultation.'
              : 'Manual admit control is currently disabled by policy.'}
          </li>
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

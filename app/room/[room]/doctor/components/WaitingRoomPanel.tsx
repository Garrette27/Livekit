'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdmitPatientResponse, WaitingPatient } from '@/lib/types';

interface WaitingRoomPanelProps {
  roomName: string;
}

interface WaitingRoomListResponse {
  success: boolean;
  waitingPatients?: WaitingPatient[];
  error?: string;
}

interface InvitationLookupResponse {
  success: boolean;
  invitationId?: string;
  error?: string;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON response but received status ${response.status}`);
  }

  return (await response.json()) as T;
}

export default function WaitingRoomPanel({ roomName }: WaitingRoomPanelProps) {
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [admittingId, setAdmittingId] = useState<string | null>(null);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const resolveInvitationId = useCallback(
    async (forceRefresh = false): Promise<string | null> => {
      if (invitationId && !forceRefresh) {
        return invitationId;
      }

      try {
        const response = await fetch(`/api/invite/get-link?roomName=${encodeURIComponent(roomName)}`);
        const result = await parseJsonResponse<InvitationLookupResponse>(response);

        if (result.success && result.invitationId) {
          setInvitationId(result.invitationId);
          return result.invitationId;
        }

        setInvitationId(null);
        return null;
      } catch (lookupError) {
        console.warn('Unable to refresh invitation id for waiting room list:', lookupError);
        setInvitationId(null);
        return null;
      }
    },
    [invitationId, roomName]
  );

  const fetchWaitingPatients = useCallback(
    async ({ forceInvitationRefresh = false, showLoading = false }: { forceInvitationRefresh?: boolean; showLoading?: boolean } = {}) => {
      if (isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      try {
        const activeInvitationId = await resolveInvitationId(forceInvitationRefresh);
        const query = activeInvitationId
          ? `invitationId=${encodeURIComponent(activeInvitationId)}`
          : `roomName=${encodeURIComponent(roomName)}`;

        const response = await fetch(`/api/waiting-room/list?${query}`);
        const result = await parseJsonResponse<WaitingRoomListResponse>(response);

        if (result.success) {
          setWaitingPatients(result.waitingPatients || []);
          return;
        }

        setError(result.error || 'Failed to fetch waiting patients');
        setWaitingPatients([]);
      } catch (fetchError) {
        console.error('Error fetching waiting patients:', fetchError);
        setError('Network error. Please try again.');
      } finally {
        isFetchingRef.current = false;
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [resolveInvitationId, roomName]
  );

  const admitPatient = async (waitingPatientId: string) => {
    try {
      setAdmittingId(waitingPatientId);
      setError(null);

      const response = await fetch('/api/waiting-room/admit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          waitingPatientId,
          roomName,
        }),
      });

      const result: AdmitPatientResponse = await parseJsonResponse<AdmitPatientResponse>(response);

      if (result.success) {
        setWaitingPatients((previous) => previous.filter((patient) => patient.id !== waitingPatientId));
        alert('Patient admitted to consultation room. They can now join the main room.');
      } else {
        setError(result.error || 'Failed to admit patient');
      }
    } catch (admitError) {
      setError('Network error. Please try again.');
      console.error('Error admitting patient:', admitError);
    } finally {
      setAdmittingId(null);
    }
  };

  useEffect(() => {
    void fetchWaitingPatients({ forceInvitationRefresh: true, showLoading: true });

    const interval = window.setInterval(() => {
      void fetchWaitingPatients();
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchWaitingPatients]);

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
        <button
          onClick={() => void fetchWaitingPatients({ forceInvitationRefresh: true, showLoading: true })}
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
                    justifyContent: 'space-between',
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
                      {patient.patientName || 'Anonymous Patient'}
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
                  <button
                    onClick={() => void admitPatient(patient.id)}
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
          <li>Click Admit to allow a patient into the consultation.</li>
          <li>The list refreshes automatically every 15 seconds.</li>
        </ul>
      </div>
    </div>
  );
}

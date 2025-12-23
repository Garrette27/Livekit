'use client';

import { useState, useEffect } from 'react';
import { WaitingPatient, AdmitPatientResponse } from '@/lib/types';

interface WaitingRoomPanelProps {
  roomName: string;
}

export default function WaitingRoomPanel({ roomName }: WaitingRoomPanelProps) {
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [admittingId, setAdmittingId] = useState<string | null>(null);

  const fetchWaitingPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First, get active invitations for this room to get invitation IDs
      // This avoids the Firestore index requirement
      const invitationsResponse = await fetch(`/api/invite/get-link?roomName=${encodeURIComponent(roomName)}`);
      const invitationsResult = await invitationsResponse.json();
      
      if (!invitationsResult.success || !invitationsResult.invitationId) {
        // No active invitation, but still try roomName query as fallback
        const response = await fetch(`/api/waiting-room/list?roomName=${encodeURIComponent(roomName)}`);
        const result = await response.json();
        
        if (result.success) {
          setWaitingPatients(result.waitingPatients || []);
        } else {
          setError(result.error || 'Failed to fetch waiting patients');
          setWaitingPatients([]);
        }
        return;
      }
      
      // Use invitationId for more efficient query (no index needed)
      const response = await fetch(`/api/waiting-room/list?invitationId=${encodeURIComponent(invitationsResult.invitationId)}`);
      const result = await response.json();

      if (result.success) {
        setWaitingPatients(result.waitingPatients || []);
      } else {
        setError(result.error || 'Failed to fetch waiting patients');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error fetching waiting patients:', err);
    } finally {
      setLoading(false);
    }
  };

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

      const result: AdmitPatientResponse = await response.json();

      if (result.success) {
        // Remove patient from waiting list
        setWaitingPatients(prev => prev.filter(p => p.id !== waitingPatientId));
        alert(`Patient admitted to consultation room. They can now join the main room.`);
      } else {
        setError(result.error || 'Failed to admit patient');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error admitting patient:', err);
    } finally {
      setAdmittingId(null);
    }
  };

  // Fetch waiting patients on mount and set up polling
  useEffect(() => {
    fetchWaitingPatients();
    const interval = setInterval(fetchWaitingPatients, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [roomName]);

  return (
    <div style={{
      padding: '1rem',
      backgroundColor: '#ffffff',
      borderRadius: '0.5rem',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
      }}>
        <h3 style={{
          fontSize: '1rem',
          fontWeight: '600',
          color: '#111827',
          margin: 0,
        }}>
          Waiting Room ({waitingPatients.length})
        </h3>
        <button
          onClick={fetchWaitingPatients}
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
          {loading ? 'Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.375rem',
          padding: '0.75rem',
          marginBottom: '1rem',
          color: '#dc2626',
          fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      {waitingPatients.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '2rem 1rem',
          color: '#6b7280',
          fontSize: '0.875rem',
        }}>
          <p>No patients waiting</p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Patients with waiting room enabled invitations will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {waitingPatients.map((patient) => {
            const joinedAt = patient.joinedAt?.toDate ? patient.joinedAt.toDate() : new Date(patient.joinedAt);
            const waitTime = Math.floor((Date.now() - joinedAt.getTime()) / 1000 / 60); // minutes

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
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '0.5rem',
                }}>
                  <div>
                    <p style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#111827',
                      margin: '0 0 0.25rem 0',
                    }}>
                      {patient.patientName || 'Anonymous Patient'}
                    </p>
                    {patient.patientEmail && (
                      <p style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        margin: 0,
                      }}>
                        {patient.patientEmail}
                      </p>
                    )}
                    <p style={{
                      fontSize: '0.7rem',
                      color: '#9ca3af',
                      margin: '0.25rem 0 0 0',
                    }}>
                      Waiting for {waitTime} minute{waitTime !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => admitPatient(patient.id)}
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
                    {admittingId === patient.id ? 'Admitting...' : '✅ Admit'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{
        marginTop: '1rem',
        padding: '0.75rem',
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '0.375rem',
        fontSize: '0.7rem',
        color: '#1e40af',
      }}>
        <p style={{ margin: 0, fontWeight: '500' }}>ℹ️ How it works:</p>
        <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem' }}>
          <li>Patients join the waiting room automatically</li>
          <li>Click "Admit" to allow a patient into the consultation</li>
          <li>The list refreshes automatically every 5 seconds</li>
        </ul>
      </div>
    </div>
  );
}


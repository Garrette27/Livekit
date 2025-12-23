'use client';

import React, { useState, useEffect } from 'react';

interface DoctorControlsPanelProps {
  doctorName: string;
  roomName: string;
  onLeave: () => void;
}

export default function DoctorControlsPanel({ doctorName, roomName, onLeave }: DoctorControlsPanelProps) {
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const fallbackLink = `https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`;

  useEffect(() => {
    const fetchInvitationLink = async () => {
      setLoadingLink(true);
      setLinkError(null);
      
      try {
        const response = await fetch(`/api/invite/get-link?roomName=${encodeURIComponent(roomName)}`);
        const result = await response.json();
        
        if (result.success) {
          setInvitationLink(result.inviteUrl);
        } else {
          setLinkError(result.error || 'No active invitation found');
          setInvitationLink(null);
        }
      } catch (err) {
        console.error('Error fetching invitation link:', err);
        setLinkError('Failed to load invitation link');
        setInvitationLink(null);
      } finally {
        setLoadingLink(false);
      }
    };

    fetchInvitationLink();
  }, [roomName]);

  const patientLink = invitationLink || fallbackLink;

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <p
          style={{
            margin: '0',
            color: '#6b7280',
            fontSize: '0.875rem',
            marginBottom: '0.5rem'
          }}
        >
          Connected as: {doctorName}
        </p>
        <p
          style={{
            margin: '0',
            color: '#6b7280',
            fontSize: '0.875rem',
            marginBottom: '0.75rem'
          }}
        >
          Room: {roomName}
        </p>
      </div>

      <div
        style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #22c55e',
          borderRadius: '0.5rem',
          padding: '0.75rem',
          marginBottom: '0.75rem'
        }}
      >
        <h4
          style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#15803d'
          }}
        >
          {invitationLink ? 'Patient Invitation Link:' : 'Patient Link:'}
        </h4>
        {loadingLink ? (
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.7rem', color: '#6b7280' }}>
            Loading invitation link...
          </p>
        ) : linkError ? (
          <div style={{ marginBottom: '0.5rem' }}>
            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.7rem', color: '#dc2626' }}>
              {linkError}
            </p>
            <p style={{ margin: '0', fontSize: '0.65rem', color: '#6b7280' }}>
              Using fallback link (direct room access)
            </p>
          </div>
        ) : null}
        <p
          style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.7rem',
            color: '#6b7280',
            wordBreak: 'break-all'
          }}
        >
          {patientLink}
        </p>
        <button
          onClick={() => {
            navigator.clipboard.writeText(patientLink);
            alert(invitationLink ? 'Invitation link copied to clipboard!' : 'Patient link copied to clipboard!');
          }}
          disabled={loadingLink}
          style={{
            backgroundColor: loadingLink ? '#9ca3af' : '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.5rem 1rem',
            fontSize: '0.75rem',
            fontWeight: '500',
            cursor: loadingLink ? 'not-allowed' : 'pointer',
            width: '100%',
            marginBottom: '0.5rem'
          }}
        >
          {loadingLink ? 'Loading...' : '📋 Copy Link'}
        </button>

        <button
          onClick={() => window.open(`/room/${roomName}/patient`, '_blank')}
          style={{
            backgroundColor: '#059669',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'inline-block',
            textAlign: 'center',
            width: '100%',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
          }}
        >
          👥 Join as Patient
        </button>

        <button
          onClick={onLeave}
          style={{
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'inline-block',
            textAlign: 'center',
            width: '100%',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
            marginTop: '0.5rem'
          }}
        >
          🚪 Leave Call
        </button>
      </div>
    </div>
  );
}



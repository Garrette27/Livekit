'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { copyTextToClipboard, fetchInvitationLink } from '@/lib/invitations/invitation-link-client';
import { useToast } from '@/components/ui/feedback/ToastProvider';

interface DoctorControlsPanelProps {
  doctorName: string;
  roomName: string;
  onLeave: () => void;
}

interface InvitationLinkResponse {
  success: boolean;
  inviteUrl?: string;
  error?: string;
}

export default function DoctorControlsPanel({ doctorName, roomName, onLeave }: DoctorControlsPanelProps) {
  const { showToast } = useToast();
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fallbackLink = `https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`;

  const loadInvitationLink = useCallback(
    async (forceRefresh = false) => {
      setLoadingLink(true);
      setLinkError(null);

      try {
        const result: InvitationLinkResponse = await fetchInvitationLink({
          roomName,
          forceRefresh,
        });

        if (result.success && result.inviteUrl) {
          setInvitationLink(result.inviteUrl);
          return;
        }

        setLinkError(result.error || 'No active invitation found');
        setInvitationLink(null);
      } catch (fetchError) {
        console.error('Error fetching invitation link:', fetchError);
        setLinkError('Failed to load invitation link');
        setInvitationLink(null);
      } finally {
        setLoadingLink(false);
      }
    },
    [roomName]
  );

  useEffect(() => {
    void loadInvitationLink();
  }, [loadInvitationLink]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopied(false);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [copied]);

  const patientLink = invitationLink || fallbackLink;

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <p
          style={{
            margin: '0',
            color: '#6b7280',
            fontSize: '0.875rem',
            marginBottom: '0.5rem',
          }}
        >
          Connected as: {doctorName}
        </p>
        <p
          style={{
            margin: '0',
            color: '#6b7280',
            fontSize: '0.875rem',
            marginBottom: '0.75rem',
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
          marginBottom: '0.75rem',
        }}
      >
        <h4
          style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#15803d',
          }}
        >
          {invitationLink ? 'Patient Invitation Link:' : 'Patient Link:'}
        </h4>

        {loadingLink ? (
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.7rem', color: '#6b7280' }}>Loading invitation link...</p>
        ) : linkError ? (
          <div style={{ marginBottom: '0.5rem' }}>
            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.7rem', color: '#dc2626' }}>{linkError}</p>
            <p style={{ margin: '0', fontSize: '0.65rem', color: '#6b7280' }}>Using fallback link (direct room access).</p>
          </div>
        ) : null}

        <p
          style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.7rem',
            color: '#6b7280',
            wordBreak: 'break-all',
          }}
        >
          {patientLink}
        </p>

        <button
          onClick={async () => {
            try {
              await copyTextToClipboard(patientLink);
              setCopied(true);
              showToast({
                kind: 'success',
                title: 'Link copied',
                message: invitationLink ? 'Invitation link copied to clipboard.' : 'Patient link copied to clipboard.',
              });
            } catch (copyError) {
              console.error('Failed to copy patient link:', copyError);
              showToast({
                kind: 'error',
                title: 'Copy failed',
                message: 'Unable to copy link. Please try again.',
              });
            }
          }}
          disabled={loadingLink}
          style={{
            backgroundColor: loadingLink ? '#9ca3af' : copied ? '#16a34a' : '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.5rem 1rem',
            fontSize: '0.75rem',
            fontWeight: '500',
            cursor: loadingLink ? 'not-allowed' : 'pointer',
            width: '100%',
            marginBottom: '0.5rem',
            transform: copied ? 'translateY(1px) scale(0.99)' : 'none',
            transition: 'all 140ms ease',
          }}
        >
          {loadingLink ? 'Loading...' : copied ? 'Copied' : 'Copy Link'}
        </button>

        <button
          onClick={() => void loadInvitationLink(true)}
          disabled={loadingLink}
          style={{
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            padding: '0.5rem 1rem',
            fontSize: '0.75rem',
            fontWeight: '500',
            cursor: loadingLink ? 'not-allowed' : 'pointer',
            width: '100%',
            marginBottom: '0.5rem',
          }}
        >
          Refresh Invitation Link
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
            marginTop: '0.25rem',
          }}
        >
          Leave Call
        </button>
      </div>
    </div>
  );
}

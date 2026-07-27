'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { copyTextToClipboard, fetchInvitationLink } from '@/lib/invitations/invitation-link-client';
import { compactInvitationUrl } from '@/lib/invitations/invitation-link-display';
import { useToast } from '@/components/ui/feedback/ToastProvider';
import type { SpeechStatus } from '../hooks/useSpeechCapture';

interface DoctorControlsPanelProps {
  doctorName: string;
  roomName: string;
  onLeave: () => void;
  showCopyInvitationLinkControl?: boolean;
  showRefreshInvitationLinkControl?: boolean;
  showLeaveCallControl?: boolean;
  speechStatus: SpeechStatus;
  speechCaptureError: string | null;
  onStartSpeechCapture: (patientConsentConfirmed: boolean) => Promise<void>;
  onStopSpeechCapture: () => void;
}

interface InvitationLinkResponse {
  success: boolean;
  inviteUrl?: string;
  error?: string;
}

export default function DoctorControlsPanel({
  doctorName,
  roomName,
  onLeave,
  showCopyInvitationLinkControl = true,
  showRefreshInvitationLinkControl = false,
  showLeaveCallControl = true,
  speechStatus,
  speechCaptureError,
  onStartSpeechCapture,
  onStopSpeechCapture,
}: DoctorControlsPanelProps) {
  const { showToast } = useToast();
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [patientConsentConfirmed, setPatientConsentConfirmed] = useState(false);

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

      <section
        aria-labelledby="speech-notes-heading"
        style={{
          border: '1px solid #bfdbfe',
          borderRadius: '0.5rem',
          padding: '0.75rem',
          marginBottom: '0.75rem',
          backgroundColor: '#eff6ff',
        }}
      >
        <h4 id="speech-notes-heading" style={{ margin: '0 0 0.4rem', fontSize: '0.875rem' }}>
          Optional speech notes
        </h4>
        <p style={{ margin: '0 0 0.6rem', color: '#374151', fontSize: '0.7rem', lineHeight: 1.4 }}>
          Browser speech recognition on this device is not a recording or a complete transcript.
          Tell the patient before starting.
        </p>
        <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start', fontSize: '0.7rem' }}>
          <input
            type="checkbox"
            checked={patientConsentConfirmed}
            disabled={speechStatus === 'listening'}
            onChange={(event) => setPatientConsentConfirmed(event.target.checked)}
          />
          The patient has verbally consented to browser-generated speech notes.
        </label>
        <p aria-live="polite" role="status" style={{ margin: '0.55rem 0', fontSize: '0.7rem' }}>
          Status: {speechStatus === 'listening' ? 'Listening' : speechStatus.replace('-', ' ')}
        </p>
        {speechCaptureError && (
          <p role="alert" style={{ margin: '0 0 0.55rem', color: '#b91c1c', fontSize: '0.7rem' }}>
            {speechCaptureError}
          </p>
        )}
        <button
          type="button"
          onClick={() =>
            speechStatus === 'listening'
              ? onStopSpeechCapture()
              : void onStartSpeechCapture(patientConsentConfirmed)
          }
          disabled={
            speechStatus === 'unsupported' ||
            (speechStatus !== 'listening' && !patientConsentConfirmed)
          }
          style={{
            width: '100%',
            padding: '0.5rem',
            border: 'none',
            borderRadius: '0.4rem',
            color: '#fff',
            backgroundColor: speechStatus === 'listening' ? '#b91c1c' : '#1d4ed8',
            cursor:
              speechStatus === 'unsupported' ||
              (speechStatus !== 'listening' && !patientConsentConfirmed)
                ? 'not-allowed'
                : 'pointer',
            opacity:
              speechStatus === 'unsupported' ||
              (speechStatus !== 'listening' && !patientConsentConfirmed)
                ? 0.55
                : 1,
          }}
        >
          {speechStatus === 'listening' ? 'Stop speech notes' : 'Start speech notes'}
        </button>
      </section>

      <div
        style={{
          backgroundColor: invitationLink ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${invitationLink ? '#22c55e' : '#f59e0b'}`,
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
            color: invitationLink ? '#15803d' : '#92400e',
          }}
        >
          Patient Invitation Link
        </h4>

        {loadingLink ? (
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.7rem', color: '#6b7280' }}>Loading invitation link...</p>
        ) : linkError ? (
          <div style={{ marginBottom: '0.5rem' }}>
            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.7rem', color: '#92400e' }}>{linkError}</p>
            <Link
              href="/doctor/invitations"
              style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 600 }}
            >
              Create or manage an invitation
            </Link>
          </div>
        ) : null}

        {invitationLink && (
          <p
            title="Use Copy Link to share the complete signed invitation"
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.7rem',
              color: '#166534',
            }}
          >
            {compactInvitationUrl(invitationLink)}
          </p>
        )}

        {showCopyInvitationLinkControl && (
          <button
            onClick={async () => {
              if (!invitationLink) {
                return;
              }
              try {
                await copyTextToClipboard(invitationLink);
                setCopied(true);
                showToast({
                  kind: 'success',
                  title: 'Link copied',
                  message: 'Invitation link copied to clipboard.',
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
            disabled={loadingLink || !invitationLink}
            style={{
              backgroundColor: loadingLink || !invitationLink ? '#9ca3af' : copied ? '#16a34a' : '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.5rem 1rem',
              fontSize: '0.75rem',
              fontWeight: '500',
              cursor: loadingLink || !invitationLink ? 'not-allowed' : 'pointer',
              width: '100%',
              marginBottom: '0.5rem',
              transform: copied ? 'translateY(1px) scale(0.99)' : 'none',
              transition: 'all 140ms ease',
            }}
          >
            {loadingLink ? 'Loading...' : copied ? 'Copied' : invitationLink ? 'Copy Link' : 'No Active Link'}
          </button>
        )}

        {showRefreshInvitationLinkControl && (
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
        )}

        {showLeaveCallControl && (
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
        )}
      </div>
    </div>
  );
}

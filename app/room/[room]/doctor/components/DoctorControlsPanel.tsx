'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { copyTextToClipboard, fetchInvitationLink } from '@/lib/invitations/invitation-link-client';
import { compactInvitationUrl } from '@/lib/invitations/invitation-link-display';
import { useToast } from '@/components/ui/feedback/ToastProvider';

interface DoctorControlsPanelProps {
  doctorName: string;
  roomName: string;
  speechLanguage: string;
  speechStatus: 'idle' | 'listening' | 'error' | 'permission-required';
  onSpeechLanguageChange: (language: string) => void;
  onLeave: () => void;
  showCopyInvitationLinkControl?: boolean;
  showRefreshInvitationLinkControl?: boolean;
  showLeaveCallControl?: boolean;
}

interface InvitationLinkResponse {
  success: boolean;
  inviteUrl?: string;
  error?: string;
}

export default function DoctorControlsPanel({
  doctorName,
  roomName,
  speechLanguage,
  speechStatus,
  onSpeechLanguageChange,
  onLeave,
  showCopyInvitationLinkControl = true,
  showRefreshInvitationLinkControl = false,
  showLeaveCallControl = true,
}: DoctorControlsPanelProps) {
  const { showToast } = useToast();
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

      <div
        style={{
          border: '1px solid #dbeafe',
          borderRadius: '0.5rem',
          padding: '0.75rem',
          marginBottom: '0.75rem',
          backgroundColor: '#eff6ff',
        }}
      >
        <label
          htmlFor="consultation-language"
          style={{ display: 'block', color: '#1e3a8a', fontSize: '0.75rem', fontWeight: 600 }}
        >
          Spoken language for transcript
        </label>
        <select
          id="consultation-language"
          value={speechLanguage}
          onChange={(event) => onSpeechLanguageChange(event.target.value)}
          style={{
            width: '100%',
            marginTop: '0.375rem',
            padding: '0.5rem',
            border: '1px solid #93c5fd',
            borderRadius: '0.375rem',
            backgroundColor: '#ffffff',
            color: '#1f2937',
            fontSize: '0.75rem',
          }}
        >
          <option value="fil-PH">Filipino / Tagalog (Taglish)</option>
          <option value="en-US">English (US)</option>
        </select>
        <p style={{ margin: '0.375rem 0 0', color: '#475569', fontSize: '0.6875rem', lineHeight: 1.4 }}>
          {speechStatus === 'listening'
            ? 'Transcript capture is listening.'
            : speechStatus === 'permission-required'
              ? 'Microphone permission is needed for transcript capture.'
              : speechStatus === 'error'
                ? 'Transcript capture is unavailable.'
                : 'Transcript capture starts after you interact with the page.'}
        </p>
      </div>

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

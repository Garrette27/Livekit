'use client';

import { useEffect, useState } from 'react';
import { Invitation } from '@/lib/types';
import { useToast } from '@/components/ui/feedback/ToastProvider';

interface InvitationResultProps {
  invitation: Invitation;
  inviteUrl: string;
  onCopyLink: () => void;
}

export default function InvitationResult({ invitation, inviteUrl, onCopyLink }: InvitationResultProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopied(false);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyInvitationLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      onCopyLink();
    } catch (error) {
      console.error('Error copying link:', error);
      showToast({
        kind: 'error',
        title: 'Copy failed',
        message: 'Failed to copy link. Please try again.',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#059669';
      case 'used': return '#2563eb';
      case 'expired': return '#dc2626';
      case 'revoked': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '✅';
      case 'used': return '🔵';
      case 'expired': return '❌';
      case 'revoked': return '🚫';
      default: return '❓';
    }
  };

  const isInvitationExpired = (invitation: Invitation): boolean => {
    if (!invitation.expiresAt) return false;
    
    let expiresAtDate: Date;
    if (invitation.expiresAt.toDate) {
      expiresAtDate = invitation.expiresAt.toDate();
    } else if (invitation.expiresAt instanceof Date) {
      expiresAtDate = invitation.expiresAt;
    } else {
      return false;
    }
    
    return new Date() > expiresAtDate;
  };

  const getEffectiveStatus = (invitation: Invitation): string => {
    if (invitation.status === 'revoked' || invitation.status === 'used' || invitation.status === 'cancelled') {
      return invitation.status;
    }
    
    if (invitation.status === 'active' && isInvitationExpired(invitation)) {
      return 'expired';
    }
    
    return invitation.status;
  };

  const effectiveStatus = getEffectiveStatus(invitation);

  return (
    <div style={{
      backgroundColor: '#f0fdf4',
      border: '1px solid #bbf7d0',
      borderRadius: '0.5rem',
      padding: '1rem',
      marginBottom: '1rem',
    }}>
      <h4 style={{ 
        margin: '0 0 0.5rem 0', 
        color: '#166534' 
      }}>
        Invitation Created Successfully!
      </h4>
      
      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
        Room: {invitation.roomName}
      </p>
      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
        Email: {invitation.emailAllowed || 'Open Invitation (No email required)'}
      </p>
      
      <div style={{ 
        margin: '0.75rem 0', 
        padding: '0.5rem', 
        backgroundColor: '#f0f9ff', 
        border: '1px solid #bae6fd', 
        borderRadius: '0.375rem' 
      }}>
        <p style={{ 
          margin: '0 0 0.5rem 0', 
          fontWeight: '600', 
          fontSize: '0.75rem', 
          color: '#1e40af' 
        }}>
          Invitation Link:
        </p>
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          alignItems: 'center' 
        }}>
          <p style={{ 
            margin: 0, 
            fontSize: '0.875rem', 
            color: '#1e40af', 
            wordBreak: 'break-all',
            flex: 1
          }}>
            {inviteUrl}
          </p>
          <button
            onClick={copyInvitationLink}
            style={{
              backgroundColor: copied ? '#16a34a' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.25rem 0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transform: copied ? 'translateY(1px) scale(0.98)' : 'none',
              transition: 'all 140ms ease'
            }}
            title="Copy link"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.25rem' }}>
          {getStatusIcon(effectiveStatus)}
        </span>
        <span style={{
          fontSize: '0.75rem',
          fontWeight: '500',
          color: getStatusColor(effectiveStatus),
          textTransform: 'uppercase'
        }}>
          {effectiveStatus}
        </span>
      </div>
      
      <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
        <strong>Created:</strong> {invitation.createdAt?.toDate?.()?.toLocaleString() || 'Unknown'}
      </p>
      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
        <strong>Expires:</strong> {invitation.expiresAt?.toDate?.()?.toLocaleString() || 'Unknown'}
      </p>
      {invitation.waitingRoomEnabled ? (
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
          <strong>Uses:</strong> {invitation.currentUses || 0} / {invitation.maxUses || 'Unlimited'}
        </p>
      ) : (
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
          <strong>Uses:</strong> {invitation.usedAt ? 1 : 0} / {invitation.maxUses || 1}
        </p>
      )}
      {invitation.emailAllowed ? (
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
          <strong>Email:</strong> {invitation.emailAllowed}
        </p>
      ) : (
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
          <strong>Type:</strong> <span style={{ color: '#059669', fontWeight: '600' }}>Open Invitation</span> (No email required)
        </p>
      )}
      {invitation.phoneAllowed && (
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
          <strong>Phone:</strong> {invitation.phoneAllowed}
        </p>
      )}
    </div>
  );
}

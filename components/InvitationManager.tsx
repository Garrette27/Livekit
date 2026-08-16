'use client';

import { useState } from 'react';
import { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { CreateInvitationRequest, CreateInvitationResponse, Invitation } from '@/lib/types';
import InvitationForm from './InvitationForm';
import InvitationResult from './InvitationResult';
import { useToast } from '@/components/ui/feedback/ToastProvider';

interface InvitationManagerProps {
  user: User;
  roomName: string;
  onInvitationCreated?: (invitationId: string) => void;
}

interface CreatedInvitationResult {
  invitation: Invitation;
  inviteUrl: string;
}

export default function InvitationManager({ user, roomName, onInvitationCreated }: InvitationManagerProps) {
  const { showToast } = useToast();
  const [createdInvitation, setCreatedInvitation] = useState<CreatedInvitationResult | null>(null);

  const handleInvitationCreated = async (formData: CreateInvitationRequest) => {
    try {
      const normalizedAllowlist = Array.from(
        new Set(
          [ ...(formData.emailAllowlist || []), ...(formData.emailAllowed ? [formData.emailAllowed] : []) ]
            .map((email) => (typeof email === 'string' ? email.toLowerCase().trim() : ''))
            .filter((email) => email.length > 0)
        )
      );
      const primaryEmail = normalizedAllowlist[0];

      const idToken = await user.getIdToken();
      const response = await fetch('/api/invite/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          ...formData,
          emailAllowed: primaryEmail,
          emailAllowlist: normalizedAllowlist,
          doctorName: user.displayName || user.email || 'Doctor',
        }),
      });

      const result: CreateInvitationResponse = await response.json();

      if (response.ok && result.success) {
        const now = Timestamp.now();
        const invitation: Invitation = {
          id: result.invitationId,
          roomName: formData.roomName,
          emailAllowed: primaryEmail,
          phoneAllowed: formData.phoneAllowed,
          expiresAt: Timestamp.fromDate(new Date(result.expiresAt)),
          maxUses: formData.maxUses ?? 999999,
          currentUses: 0,
          maxPatients: formData.maxPatients ?? 10,
          waitingRoomEnabled: formData.waitingRoomEnabled ?? true,
          createdBy: user.uid,
          createdAt: now,
          status: 'active',
          metadata: {
            createdBy: user.uid,
            doctorName: user.displayName || user.email || 'Doctor',
            doctorEmail: user.email || '',
            roomName: formData.roomName,
            constraints: {
              email: primaryEmail,
              ...(normalizedAllowlist.length > 0 ? { emails: normalizedAllowlist } : {}),
              phone: formData.phoneAllowed,
            },
            security: {
              singleUse: formData.waitingRoomEnabled !== true,
              timeLimited: (formData.expiresInHours ?? 24) > 0,
              usagePolicy: formData.waitingRoomEnabled === true
                ? 'reusable-until-expiry'
                : 'single-use',
              admissionPolicy: normalizedAllowlist.length > 0
                ? 'verified-allowlist-or-doctor-admit'
                : 'doctor-admit',
            },
          },
          audit: {
            created: now,
            lastAccessed: undefined,
            accessAttempts: [],
            violations: [],
          },
        };

        setCreatedInvitation({
          invitation,
          inviteUrl: result.inviteUrl,
        });
        onInvitationCreated?.(result.invitationId);
      } else {
        showToast({
          kind: 'error',
          title: 'Create failed',
          message: result.error || 'Failed to create invitation.',
        });
      }
    } catch (err) {
      console.error('Error creating invitation:', err);
      showToast({
        kind: 'error',
        title: 'Network error',
        message: 'Network error. Please try again.',
      });
    }
  };

  const handleCopySuccess = () => {
    showToast({
      kind: 'success',
      title: 'Link copied',
      message: 'Invitation link copied to clipboard.',
    });
  };

  const resetForm = () => {
    setCreatedInvitation(null);
  };

  return (
    <div style={{
      backgroundColor: 'transparent',
      borderRadius: '0.5rem',
      padding: '0',
      marginBottom: '0'
    }}>
      {createdInvitation ? (
        <div style={{ marginBottom: '1rem' }}>
          <InvitationResult 
            invitation={createdInvitation.invitation}
            inviteUrl={createdInvitation.inviteUrl}
            onCopyLink={handleCopySuccess}
          />
          <button
            onClick={resetForm}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              marginTop: '0.5rem'
            }}
          >
            Create Another Invitation
          </button>
        </div>
      ) : (
        <InvitationForm
          roomName={roomName}
          onInvitationCreated={handleInvitationCreated}
        />
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { CreateInvitationRequest, CreateInvitationResponse, Invitation } from '@/lib/types';
import InvitationForm from './InvitationForm';
import InvitationResult from './InvitationResult';

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
  const [createdInvitation, setCreatedInvitation] = useState<CreatedInvitationResult | null>(null);

  const handleInvitationCreated = async (formData: CreateInvitationRequest) => {
    try {
      const response = await fetch('/api/invite/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          doctorUserId: user.uid,
          doctorEmail: user.email,
          doctorName: user.displayName || user.email || 'Doctor',
        }),
      });

      const result: CreateInvitationResponse = await response.json();

      if (response.ok && result.success) {
        const now = Timestamp.now();
        const invitation: Invitation = {
          id: result.invitationId,
          roomName: formData.roomName,
          emailAllowed: formData.emailAllowed,
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
              email: formData.emailAllowed,
              phone: formData.phoneAllowed,
            },
            security: {
              singleUse: formData.maxUses === 1,
              timeLimited: (formData.expiresInHours ?? 24) > 0,
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
        alert(result.error || 'Failed to create invitation');
      }
    } catch (err) {
      console.error('Error creating invitation:', err);
      alert('Network error. Please try again.');
    }
  };

  const handleCopySuccess = () => {
    alert('Invitation link copied to clipboard!');
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

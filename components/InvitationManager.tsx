'use client';

import { useState } from 'react';
import { User } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp, collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Invitation } from '@/lib/types';
import InvitationForm from './InvitationForm';
import InvitationResult from './InvitationResult';

interface InvitationManagerProps {
  user: User;
  roomName: string;
  onInvitationCreated?: (invitationId: string) => void;
}

export default function InvitationManager({ user, roomName, onInvitationCreated }: InvitationManagerProps) {
  const [createdInvitation, setCreatedInvitation] = useState<Invitation | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleInvitationCreated = async (formData: any) => {
    setIsCreating(true);
    
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

      const result = await response.json();

      if (result.success) {
        const invitation: Invitation = {
          id: result.invitationId,
          roomName: formData.roomName,
          emailAllowed: formData.emailAllowed,
          phoneAllowed: formData.phoneAllowed,
          expiresAt: Timestamp.fromDate(new Date(result.expiresAt)),
          maxUses: formData.maxUses,
          currentUses: 0,
          maxPatients: formData.maxPatients,
          waitingRoomEnabled: formData.waitingRoomEnabled,
          createdBy: user.uid,
          createdAt: serverTimestamp() as any,
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
              timeLimited: formData.expiresInHours > 0,
            },
          },
          audit: {
            created: serverTimestamp() as any,
            lastAccessed: undefined,
            accessAttempts: [],
            violations: [],
          },
        };

        setCreatedInvitation(invitation);
        onInvitationCreated?.(result.invitationId);
      } else {
        alert(result.error || 'Failed to create invitation');
      }
    } catch (err) {
      console.error('Error creating invitation:', err);
      alert('Network error. Please try again.');
    } finally {
      setIsCreating(false);
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
            invitation={createdInvitation}
            user={user}
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
          user={user}
          roomName={roomName}
          onInvitationCreated={handleInvitationCreated}
        />
      )}
    </div>
  );
}

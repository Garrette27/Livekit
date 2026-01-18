'use client';

import { User } from 'firebase/auth';
import { useInvitationForm } from '@/hooks/useInvitationForm';
import InvitationForm from './InvitationForm';
import InvitationResult from './InvitationResult';

interface InvitationManagerProps {
  user: User;
  roomName: string;
  onInvitationCreated?: (invitationId: string) => void;
}

export default function InvitationManager({ user, roomName, onInvitationCreated }: InvitationManagerProps) {
  const {
    formData,
    setFormData,
    isCreating,
    createdInvitation,
    error,
    handleCreateInvitation,
    resetForm,
  } = useInvitationForm({ user, roomName });

  const handleSubmit = async () => {
    try {
      const invitation = await handleCreateInvitation();
      onInvitationCreated?.(invitation.invitationId);
    } catch (err) {
      console.error('Failed to create invitation:', err);
    }
  };

  const handleCopySuccess = () => {
    alert('Invitation link copied to clipboard!');
  };

  return (
    <div style={{
      backgroundColor: 'transparent',
      borderRadius: '0.5rem',
      padding: '0',
      marginBottom: '0'
    }}>
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.5rem',
          padding: '0.75rem',
          marginBottom: '1rem',
          color: '#dc2626',
          fontSize: '0.8rem'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

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
          formData={formData}
          setFormData={setFormData}
          isCreating={isCreating}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
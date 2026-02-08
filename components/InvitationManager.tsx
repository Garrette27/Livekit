'use client';

import { useState } from 'react';
import { User } from 'firebase/auth';

interface InvitationFormData {
  email: string;
  role: string;
  message: string;
}

interface Invitation {
  invitationId: string;
  roomName: string;
  email: string;
  role: string;
  message: string;
  createdAt: Date;
}

interface InvitationManagerProps {
  user: User;
  roomName: string;
  onInvitationCreated?: (invitationId: string) => void;
}

export default function InvitationManager({ user, roomName, onInvitationCreated }: InvitationManagerProps) {
  const [formData, setFormData] = useState<InvitationFormData>({
    email: '',
    role: 'participant',
    message: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createdInvitation, setCreatedInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    try {
      setIsCreating(true);
      setError(null);

      // Create invitation logic here
      const invitation: Invitation = {
        invitationId: `inv_${Date.now()}`,
        roomName,
        email: formData.email,
        role: formData.role,
        message: formData.message,
        createdAt: new Date()
      };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      setCreatedInvitation(invitation);
      onInvitationCreated?.(invitation.invitationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invitation');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopySuccess = () => {
    alert('Invitation link copied to clipboard!');
  };

  const resetForm = () => {
    setFormData({
      email: '',
      role: 'participant',
      message: ''
    });
    setCreatedInvitation(null);
    setError(null);
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
          fontSize: '0.875rem'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {createdInvitation ? (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#166534' }}>
              Invitation Created Successfully!
            </h4>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
              Room: {createdInvitation.roomName}
            </p>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
              Email: {createdInvitation.email}
            </p>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem' }}>
              Role: {createdInvitation.role}
            </p>
            <button
              onClick={handleCopySuccess}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Copy Invitation Link
            </button>
          </div>
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
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600' }}>
            Create Invitation
          </h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter email address"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
              required
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            >
              <option value="participant">Participant</option>
              <option value="moderator">Moderator</option>
              <option value="observer">Observer</option>
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Message (Optional)
            </label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              placeholder="Add a personal message..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                resize: 'vertical'
              }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isCreating || !formData.email}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: isCreating || !formData.email ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: isCreating || !formData.email ? 'not-allowed' : 'pointer'
            }}
          >
            {isCreating ? 'Creating...' : 'Create Invitation'}
          </button>
        </div>
      )}
    </div>
  );
}
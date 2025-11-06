'use client';

import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { 
  InvitationFormData, 
  CreateInvitationRequest, 
  CreateInvitationResponse,
  InvitationListItem 
} from '@/lib/types';

interface InvitationManagerProps {
  user: User;
  roomName: string;
}

export default function InvitationManager({ user, roomName }: InvitationManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [createdInvitation, setCreatedInvitation] = useState<CreateInvitationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<InvitationFormData>({
    email: '',
    phone: '',
    expiresInHours: 24,
  });


  const handleCreateInvitation = async () => {
    if (!formData.email.trim()) {
      setError('Please enter a patient email address');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const request: CreateInvitationRequest = {
        roomName,
        emailAllowed: formData.email,
        phoneAllowed: formData.phone?.trim() || undefined,
        expiresInHours: formData.expiresInHours,
      };

      const response = await fetch('/api/invite/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result: CreateInvitationResponse = await response.json();

      if (result.success) {
        setCreatedInvitation(result);
        // Reset form
        setFormData({
          email: '',
          phone: '',
          expiresInHours: 24,
        });
      } else {
        setError(result.error || 'Failed to create invitation');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error creating invitation:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Invitation link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
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

      {createdInvitation && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <h4 style={{
            fontSize: '0.9rem',
            fontWeight: '600',
            color: '#166534',
            marginBottom: '0.75rem'
          }}>
            ✅ Invitation Created!
          </h4>
          
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Patient Invitation Link:
            </label>
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center'
            }}>
              <input
                type="text"
                value={createdInvitation.inviteUrl}
                readOnly
                style={{
                  flex: '1',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.7rem',
                  backgroundColor: '#f9fafb'
                }}
              />
              <button
                onClick={() => copyToClipboard(createdInvitation.inviteUrl)}
                style={{
                  backgroundColor: '#059669',
                  color: 'white',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.7rem'
                }}
              >
                📋
              </button>
            </div>
          </div>

          <div style={{
            fontSize: '0.7rem',
            color: '#6b7280'
          }}>
            <p><strong>Expires:</strong> {new Date(createdInvitation.expiresAt).toLocaleString()}</p>
            <p><strong>ID:</strong> {createdInvitation.invitationId}</p>
            {createdInvitation.existingAccount && (
              <p style={{ color: '#059669', fontWeight: '500', marginTop: '0.5rem' }}>
                ℹ️ {createdInvitation.existingAccount.message}
              </p>
            )}
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => {
                const doctorJoinUrl = `/room/${roomName}/doctor`;
                window.open(doctorJoinUrl, '_blank');
              }}
              style={{
                backgroundColor: '#059669',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: '500',
                cursor: 'pointer',
                flex: '1'
              }}
            >
              🩺 Join as Doctor
            </button>
          </div>
        </div>
      )}

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        {/* Email Input */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.75rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Patient Email *
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => {
              const newEmail = e.target.value;
              setFormData(prev => ({ ...prev, email: newEmail }));
            }}
            placeholder="patient@example.com"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.8rem'
            }}
            autoComplete="email"
          />
          <p style={{
            fontSize: '0.65rem',
            color: '#6b7280',
            marginTop: '0.25rem'
          }}>
            The system will automatically verify the patient's device, location, and browser after they register.
          </p>
        </div>

        {/* Phone Input (Optional) */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.75rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Patient Phone (Optional)
          </label>
          <input
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => {
              const newPhone = e.target.value;
              setFormData(prev => ({ ...prev, phone: newPhone }));
            }}
            placeholder="+1234567890"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.8rem'
            }}
            autoComplete="tel"
          />
        </div>

        {/* Expiration Time */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.75rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Expires In
          </label>
          <select
            value={formData.expiresInHours}
            onChange={(e) => setFormData({ ...formData, expiresInHours: parseInt(e.target.value) })}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.8rem'
            }}
          >
            <option value={1}>1 Hour</option>
            <option value={6}>6 Hours</option>
            <option value={12}>12 Hours</option>
            <option value={24}>24 Hours</option>
            <option value={48}>48 Hours</option>
            <option value={72}>72 Hours</option>
            <option value={168}>1 Week</option>
          </select>
        </div>
      </div>

      {/* Info Box */}
      <div style={{
        marginBottom: '1rem',
        padding: '0.75rem',
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '0.375rem'
      }}>
        <p style={{
          fontSize: '0.7rem',
          color: '#1e40af',
          margin: 0,
          lineHeight: '1.5'
        }}>
          <strong>ℹ️ Privacy-Compliant System:</strong> Device ID, location, and browser information are only collected after the patient provides consent during registration. The system will automatically verify these details when the patient accesses the invitation link.
        </p>
      </div>

      {/* Create Button */}
      <button
        onClick={handleCreateInvitation}
        disabled={isCreating}
        style={{
          backgroundColor: isCreating ? '#9ca3af' : '#059669',
          color: 'white',
          padding: '0.75rem 1rem',
          borderRadius: '0.375rem',
          border: 'none',
          fontWeight: '600',
          fontSize: '0.8rem',
          cursor: isCreating ? 'not-allowed' : 'pointer',
          width: '100%',
          transition: 'background-color 0.2s ease'
        }}
      >
        {isCreating ? 'Creating...' : '🔐 Create Invitation'}
      </button>
    </div>
  );
}

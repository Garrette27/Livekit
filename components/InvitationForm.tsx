'use client';

import { useEffect, useState } from 'react';
import { CreateInvitationRequest } from '@/lib/types';

interface InvitationFormProps {
  roomName: string;
  onInvitationCreated?: (formData: CreateInvitationRequest) => Promise<void> | void;
}

export default function InvitationForm({ roomName, onInvitationCreated }: InvitationFormProps) {
  const [formData, setFormData] = useState<CreateInvitationRequest>({
    roomName,
    expiresInHours: 24,
    waitingRoomEnabled: true, // Enable waiting room by default
    maxPatients: 10, // Default to 10 patients
    maxUses: 999999, // Unlimited uses for waiting room
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData((previous) => ({
      ...previous,
      roomName,
    }));
  }, [roomName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.roomName.trim()) {
      setError('Room name is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Parent owns API side effects and result state.
      await onInvitationCreated?.(formData);
    } catch (err) {
      console.error('Error creating invitation:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '0.5rem',
      padding: '1.5rem',
      marginBottom: '1rem',
    }}>
      <h3 style={{ 
        fontSize: '1.125rem', 
        fontWeight: '600', 
        color: '#111827', 
        marginBottom: '1rem' 
      }}>
        Create Invitation
      </h3>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            fontWeight: '500', 
            color: '#374151', 
            marginBottom: '0.5rem' 
          }}>
            Room Name
          </label>
          <div
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '1rem',
              backgroundColor: '#f9fafb',
              color: '#111827',
            }}
          >
            {formData.roomName}
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            fontWeight: '500', 
            color: '#374151', 
            marginBottom: '0.5rem' 
          }}>
            Email Address
          </label>
          <input
            type="email"
            name="emailAllowed"
            value={formData.emailAllowed || ''}
            onChange={handleInputChange}
            placeholder="Enter email address (optional)"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '1rem',
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            fontWeight: '500', 
            color: '#374151', 
            marginBottom: '0.5rem' 
          }}>
            Expires in
          </label>
          <select
            name="expiresInHours"
            value={formData.expiresInHours}
            onChange={handleInputChange}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '1rem',
            }}
          >
            <option value={1}>1 hour</option>
            <option value={6}>6 hours</option>
            <option value={12}>12 hours</option>
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
            <option value={72}>3 days</option>
            <option value={168}>1 week</option>
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            fontWeight: '500', 
            color: '#374151', 
            marginBottom: '0.5rem' 
          }}>
            🚪 Waiting Room: Maximum patients
          </label>
          <input
            type="number"
            name="maxPatients"
            value={formData.maxPatients || 10}
            onChange={handleInputChange}
            min="1"
            max="100"
            placeholder="Maximum number of patients"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '1rem',
            }}
          />
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            padding: '0.75rem',
            marginBottom: '1rem',
            color: '#dc2626',
            fontSize: '0.875rem',
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isCreating}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: isCreating ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            fontSize: '1rem',
            fontWeight: '500',
            cursor: isCreating ? 'not-allowed' : 'pointer',
          }}
        >
          {isCreating ? 'Creating...' : 'Create Invitation'}
        </button>
      </form>
    </div>
  );
}

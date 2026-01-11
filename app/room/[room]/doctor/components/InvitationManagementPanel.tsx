'use client';

import React, { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { 
  InvitationFormData, 
  CreateInvitationRequest, 
  CreateInvitationResponse,
  InvitationListItem 
} from '@/lib/types';

interface InvitationManagementPanelProps {
  user: User;
  roomName: string;
  onInvitationCreated?: (invitationId: string) => void;
}

export default function InvitationManagementPanel({ user, roomName, onInvitationCreated }: InvitationManagementPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [createdInvitation, setCreatedInvitation] = useState<CreateInvitationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeInvitations, setActiveInvitations] = useState<InvitationListItem[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<InvitationFormData>({
    email: '',
    phone: '',
    expiresInHours: 24,
    waitingRoomEnabled: false,
    maxPatients: 10,
  });

  // Fetch active invitations for this room
  useEffect(() => {
    const fetchActiveInvitations = async () => {
      try {
        const response = await fetch(`/api/invite/list?roomName=${encodeURIComponent(roomName)}`);
        const result = await response.json();
        
        if (result.success) {
          setActiveInvitations(result.invitations || []);
        } else {
          console.error('Failed to fetch invitations:', result.error);
        }
      } catch (err) {
        console.error('Error fetching invitations:', err);
      } finally {
        setLoadingInvitations(false);
      }
    };

    fetchActiveInvitations();
  }, [roomName]);

  const handleCreateInvitation = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const request: CreateInvitationRequest = {
        roomName,
        ...(formData.email.trim() && { emailAllowed: formData.email.trim() }),
        ...(formData.phone?.trim() && { phoneAllowed: formData.phone.trim() }),
        expiresInHours: formData.expiresInHours,
        waitingRoomEnabled: formData.waitingRoomEnabled || false,
        maxPatients: formData.waitingRoomEnabled ? (formData.maxPatients || 10) : undefined,
        maxUses: formData.waitingRoomEnabled ? undefined : 1,
        doctorUserId: user.uid,
        doctorEmail: user.email || undefined,
        doctorName: user.displayName || undefined,
      };

      const response = await fetch('/api/invite/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (result.success) {
        setCreatedInvitation(result);
        setIsCreating(false);
        setShowCreateForm(false);
        setFormData({
          email: '',
          phone: '',
          expiresInHours: 24,
          waitingRoomEnabled: false,
          maxPatients: 10,
        });
        
        // Refresh invitations list
        const listResponse = await fetch(`/api/invite/list?roomName=${encodeURIComponent(roomName)}`);
        const listResult = await listResponse.json();
        if (listResult.success) {
          setActiveInvitations(listResult.invitations || []);
        }
        
        if (onInvitationCreated) {
          onInvitationCreated(result.invitationId);
        }
      } else {
        setError(result.error || 'Failed to create invitation');
        setIsCreating(false);
      }
    } catch (err) {
      setError('An error occurred while creating the invitation');
      setIsCreating(false);
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    alert('Invitation link copied to clipboard!');
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const response = await fetch('/api/invite/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invitationId }),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh invitations list
        const listResponse = await fetch(`/api/invite/list?roomName=${encodeURIComponent(roomName)}`);
        const listResult = await listResponse.json();
        if (listResult.success) {
          setActiveInvitations(listResult.invitations || []);
        }
      } else {
        setError(result.error || 'Failed to revoke invitation');
      }
    } catch (err) {
      setError('An error occurred while revoking the invitation');
    }
  };

  return (
    <div style={{
      padding: '1rem',
      height: '100%',
      overflowY: 'auto',
      backgroundColor: '#f8fafc',
      borderLeft: '1px solid #e2e8f0'
    }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{
          margin: '0 0 0.5rem 0',
          fontSize: '1.125rem',
          fontWeight: '600',
          color: '#1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          📧 Invitation Management
        </h3>
        <p style={{
          margin: '0',
          fontSize: '0.875rem',
          color: '#64748b'
        }}>
          Room: {roomName}
        </p>
      </div>

      {/* Create New Invitation Button */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer',
            width: '100%',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
        >
          {showCreateForm ? '➖ Cancel' : '➕ Create New Invitation'}
        </button>
      </div>

      {/* Create Invitation Form */}
      {showCreateForm && (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.25rem'
            }}>
              Email (optional)
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="patient@example.com"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.25rem'
            }}>
              Phone (optional)
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1234567890"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.25rem'
            }}>
              Expires In (hours)
            </label>
            <input
              type="number"
              min="1"
              max="168"
              value={formData.expiresInHours}
              onChange={(e) => setFormData({ ...formData, expiresInHours: parseInt(e.target.value) || 24 })}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151'
            }}>
              <input
                type="checkbox"
                checked={formData.waitingRoomEnabled}
                onChange={(e) => setFormData({ ...formData, waitingRoomEnabled: e.target.checked })}
                style={{
                  width: '1rem',
                  height: '1rem'
                }}
              />
              Enable Waiting Room
            </label>
          </div>

          {formData.waitingRoomEnabled && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.25rem'
              }}>
                Max Patients
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={formData.maxPatients}
                onChange={(e) => setFormData({ ...formData, maxPatients: parseInt(e.target.value) || 10 })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              />
            </div>
          )}

          <button
            onClick={handleCreateInvitation}
            disabled={isCreating}
            style={{
              backgroundColor: isCreating ? '#9ca3af' : '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.625rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              width: '100%'
            }}
          >
            {isCreating ? 'Creating...' : '📤 Create Invitation'}
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.375rem',
          padding: '0.75rem',
          marginBottom: '1rem'
        }}>
          <p style={{
            margin: '0',
            fontSize: '0.875rem',
            color: '#dc2626'
          }}>
            ⚠️ {error}
          </p>
        </div>
      )}

      {/* Success Display */}
      {createdInvitation && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '0.375rem',
          padding: '0.75rem',
          marginBottom: '1rem'
        }}>
          <p style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.875rem',
            color: '#15803d',
            fontWeight: '500'
          }}>
            ✅ Invitation created successfully!
          </p>
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #d1fae5',
            borderRadius: '0.25rem',
            padding: '0.5rem',
            marginBottom: '0.5rem'
          }}>
            <p style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.75rem',
              color: '#6b7280',
              wordBreak: 'break-all'
            }}>
              {createdInvitation.inviteUrl}
            </p>
            <button
              onClick={() => handleCopyLink(createdInvitation.inviteUrl)}
              style={{
                backgroundColor: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '0.25rem',
                padding: '0.375rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: '500',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              📋 Copy Link
            </button>
          </div>
        </div>
      )}

      {/* Active Invitations */}
      <div>
        <h4 style={{
          margin: '0 0 1rem 0',
          fontSize: '1rem',
          fontWeight: '600',
          color: '#1e293b'
        }}>
          Active Invitations ({activeInvitations.length})
        </h4>

        {loadingInvitations ? (
          <p style={{
            margin: '0',
            fontSize: '0.875rem',
            color: '#6b7280',
            textAlign: 'center',
            padding: '1rem'
          }}>
            Loading invitations...
          </p>
        ) : activeInvitations.length === 0 ? (
          <p style={{
            margin: '0',
            fontSize: '0.875rem',
            color: '#6b7280',
            textAlign: 'center',
            padding: '1rem',
            backgroundColor: '#f8fafc',
            border: '1px dashed #d1d5db',
            borderRadius: '0.375rem'
          }}>
            No active invitations
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeInvitations.map((invitation) => (
              <div
                key={invitation.id}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.375rem',
                  padding: '0.75rem'
                }}
              >
                <div style={{ marginBottom: '0.5rem' }}>
                  <p style={{
                    margin: '0 0 0.25rem 0',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#1e293b'
                  }}>
                    {invitation.email || 'Direct Link'}
                  </p>
                  <p style={{
                    margin: '0',
                    fontSize: '0.75rem',
                    color: '#64748b'
                  }}>
                    Created: {new Date(invitation.createdAt).toLocaleString()}
                  </p>
                  <p style={{
                    margin: '0',
                    fontSize: '0.75rem',
                    color: '#64748b'
                  }}>
                    Expires: {new Date(invitation.expiresAt).toLocaleString()}
                  </p>
                  
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleCopyLink(`${window.location.origin}/room/${roomName}/patient?invitation=${invitation.id}`)}
                    style={{
                      backgroundColor: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      flex: 1
                    }}
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={() => handleRevokeInvitation(invitation.id)}
                    style={{
                      backgroundColor: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      flex: 1
                    }}
                  >
                    🚫 Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
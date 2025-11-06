'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import InvitationManager from '@/components/InvitationManager';
import { Invitation } from '@/lib/types';

export default function InvitationsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string>('');

  useEffect(() => {
    if (auth) {
      return onAuthStateChanged(auth, (user) => {
        setUser(user);
      });
    }
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }

    // Listen to invitations created by this user
    const invitationsQuery = query(
      collection(db, 'invitations'),
      where('createdBy', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(invitationsQuery, (snapshot) => {
      const invitationData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Invitation[];
      setInvitations(invitationData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const revokeInvitation = async (invitationId: string) => {
    if (!db) return;
    
    try {
      const invitationRef = doc(db, 'invitations', invitationId);
      await updateDoc(invitationRef, {
        status: 'revoked',
        revokedAt: new Date()
      });
      alert('Invitation revoked successfully');
    } catch (error) {
      console.error('Error revoking invitation:', error);
      alert('Failed to revoke invitation');
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

  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#F9FAFB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '3rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1e40af', marginBottom: '1rem' }}>
            Please Sign In
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
            You need to be signed in to manage invitations.
          </p>
          <Link
            href="/login"
            style={{
              display: 'inline-block',
              backgroundColor: '#2563eb',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.75rem',
              fontWeight: '600',
              textDecoration: 'none'
            }}
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F9FAFB',
      padding: '2rem'
    }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: 'white', 
        borderBottom: '1px solid #E5E7EB', 
        padding: '1rem 2rem',
        marginBottom: '2rem',
        borderRadius: '0.75rem'
      }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>Invitation Management</h1>
            <p style={{ color: '#4B5563' }}>Create and manage secure patient invitations</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <Link href="/dashboard" style={{ color: '#2563EB', fontSize: '1.125rem', fontWeight: '500', textDecoration: 'none' }}>
              Dashboard
            </Link>
            <Link href="/" style={{ color: '#059669', fontSize: '1.125rem', fontWeight: '500', textDecoration: 'none' }}>
              Home
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Create New Invitation */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
            Create New Invitation
          </h2>
          <p style={{ color: '#6B7280', marginBottom: '1rem' }}>
            Create a secure invitation for a specific room
          </p>
          
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e40af', marginBottom: '0.75rem' }}>
              How it works:
            </h3>
            <ul style={{ fontSize: '0.875rem', color: '#1e40af', margin: 0, paddingLeft: '1.25rem', lineHeight: '1.75' }}>
              <li><strong>Patient:</strong> Uses the invitation link to join and register (if first time)</li>
              <li><strong>Doctor:</strong> Uses the 'Join as Doctor' button (no invitation needed)</li>
              <li><strong>Security:</strong> System automatically verifies patient's device, location, and browser after registration with consent</li>
            </ul>
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
              Room Name
            </label>
            <input
              type="text"
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              placeholder="Enter room name (e.g., dr-smith-aug15)"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #D1D5DB',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
          </div>

          {selectedRoom && (
            <InvitationManager user={user} roomName={selectedRoom} />
          )}
        </div>

        {/* Existing Invitations */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
            Your Invitations
          </h2>
          <p style={{ color: '#6B7280', marginBottom: '1.5rem' }}>
            Manage your existing invitations
          </p>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{
                width: '2rem',
                height: '2rem',
                border: '2px solid #dbeafe',
                borderTop: '2px solid #2563eb',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem'
              }}></div>
              <p style={{ color: '#6B7280' }}>Loading invitations...</p>
            </div>
          ) : invitations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
              <p>No invitations created yet.</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Create your first invitation using the form on the left.
              </p>
            </div>
          ) : (
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  style={{
                    border: '1px solid #E5E7EB',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    marginBottom: '1rem',
                    backgroundColor: '#F9FAFB'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '0.25rem' }}>
                        Room: {invitation.roomName}
                      </h3>
                      <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                        Patient: {invitation.emailAllowed}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>
                        {getStatusIcon(invitation.status)}
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: getStatusColor(invitation.status),
                        textTransform: 'uppercase'
                      }}>
                        {invitation.status}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '0.75rem' }}>
                    <p><strong>Created:</strong> {invitation.createdAt?.toDate?.()?.toLocaleString() || 'Unknown'}</p>
                    <p><strong>Expires:</strong> {invitation.expiresAt?.toDate?.()?.toLocaleString() || 'Unknown'}</p>
                    <p><strong>Uses:</strong> {invitation.usedAt ? 1 : 0} / {invitation.maxUses || 1}</p>
                    <p><strong>Email:</strong> {invitation.emailAllowed}</p>
                    {invitation.phoneAllowed && (
                      <p><strong>Phone:</strong> {invitation.phoneAllowed}</p>
                    )}
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                      <strong>Note:</strong> Device, location, and browser verification is handled automatically via user registration.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {invitation.status === 'active' && (
                      <>
                        <button
                          onClick={() => {
                            // Generate doctor join URL
                            const doctorJoinUrl = `/room/${invitation.roomName}/doctor`;
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
                            cursor: 'pointer'
                          }}
                        >
                          🩺 Join as Doctor
                        </button>
                        <button
                          onClick={() => revokeInvitation(invitation.id)}
                          style={{
                            backgroundColor: '#dc2626',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.375rem',
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                        >
                          Revoke
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(invitation.id);
                        alert('Invitation ID copied to clipboard!');
                      }}
                      style={{
                        backgroundColor: '#6b7280',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.375rem',
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      Copy ID
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import InvitationManager from '@/components/InvitationManager';
import { Invitation, WaitingPatient, AdmitPatientResponse } from '@/lib/types';
import { isDoctor } from '@/lib/auth-utils';

export default function DoctorInvitationsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([]);
  const [loadingWaiting, setLoadingWaiting] = useState(false);
  const [admittingId, setAdmittingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const router = useRouter();

  // Persist room name in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRoom = localStorage.getItem('doctor_selected_room');
      if (savedRoom) {
        setSelectedRoom(savedRoom);
      }
    }
  }, []);

  // Save room name to localStorage when it changes
  useEffect(() => {
    if (selectedRoom && typeof window !== 'undefined') {
      localStorage.setItem('doctor_selected_room', selectedRoom);
    }
  }, [selectedRoom]);

  useEffect(() => {
    if (auth) {
      return onAuthStateChanged(auth, async (user) => {
        setUser(user);
        if (user) {
          const doctor = await isDoctor(user);
          setIsAuthorized(doctor);
          if (!doctor) {
            router.push('/');
          }
        } else {
          router.push('/doctor/login');
        }
      });
    }
  }, [router]);

  useEffect(() => {
    if (!user || !db || !isAuthorized) {
      setLoading(false);
      return;
    }

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
  }, [user, isAuthorized]);

  // Fetch waiting patients for all active invitations with waiting room enabled
  useEffect(() => {
    if (!user || !db || !isAuthorized) return;

    const activeInvitations = invitations.filter(inv => 
      inv.status === 'active' && inv.waitingRoomEnabled === true
    );

    if (activeInvitations.length === 0) {
      setWaitingPatients([]);
      return;
    }

    // Type guard - ensure db is not undefined
    if (!db) return;

    setLoadingWaiting(true);
    const roomNames = activeInvitations.map(inv => inv.roomName);
    const invitationIds = activeInvitations.map(inv => inv.id);

    // Store db in a const to help TypeScript understand it's non-null
    const firestoreDb = db;

    // Fetch waiting patients for all active waiting room invitations
    const waitingQueries = invitationIds.map(invitationId => {
      return query(
        collection(firestoreDb, 'waitingPatients'),
        where('invitationId', '==', invitationId),
        where('status', '==', 'waiting')
        // Note: Removed orderBy to avoid index requirement - we'll sort in JavaScript
      );
    });

    const unsubscribes = waitingQueries.map((q, index) => 
      onSnapshot(q, (snapshot) => {
        const patients = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WaitingPatient[];

        setWaitingPatients(prev => {
          // Remove old patients for this invitation and add new ones
          const filtered = prev.filter(p => p.invitationId !== invitationIds[index]);
          const combined = [...filtered, ...patients];
          // Sort by joinedAt time
          const sorted = combined.sort((a, b) => {
            const aTime = a.joinedAt?.toMillis?.() || 
                         (a.joinedAt instanceof Date ? a.joinedAt.getTime() : 
                          (a.joinedAt ? new Date(a.joinedAt as any).getTime() : 0));
            const bTime = b.joinedAt?.toMillis?.() || 
                         (b.joinedAt instanceof Date ? b.joinedAt.getTime() : 
                          (b.joinedAt ? new Date(b.joinedAt as any).getTime() : 0));
            return aTime - bTime;
          });
          return sorted;
        });
        setLoadingWaiting(false);
      }, (error) => {
        console.error('Error fetching waiting patients:', error);
        setLoadingWaiting(false);
      })
    );

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [invitations, user, db, isAuthorized]);

  const admitPatient = async (waitingPatient: WaitingPatient) => {
    try {
      setAdmittingId(waitingPatient.id);
      const response = await fetch('/api/waiting-room/admit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          waitingPatientId: waitingPatient.id,
          roomName: waitingPatient.roomName,
        }),
      });

      const result: AdmitPatientResponse = await response.json();

      if (result.success) {
        alert(`Patient ${waitingPatient.patientName || waitingPatient.patientEmail || 'Unknown'} admitted to consultation room.`);
        // The real-time listener will update the list automatically
      } else {
        alert(result.error || 'Failed to admit patient');
      }
    } catch (err) {
      alert('Network error. Please try again.');
      console.error('Error admitting patient:', err);
    } finally {
      setAdmittingId(null);
    }
  };

  const rejectPatient = async (waitingPatientId: string) => {
    if (!confirm('Are you sure you want to remove this patient from the waiting room?')) {
      return;
    }

    try {
      setRejectingId(waitingPatientId);
      const response = await fetch('/api/waiting-room/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          waitingPatientId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // The real-time listener will update the list automatically
      } else {
        alert(result.error || 'Failed to remove patient');
      }
    } catch (err) {
      alert('Network error. Please try again.');
      console.error('Error rejecting patient:', err);
    } finally {
      setRejectingId(null);
    }
  };

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

  if (!isAuthorized) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#F9FAFB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            border: '2px solid #dbeafe',
            borderTop: '2px solid #2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1.5rem'
          }}></div>
          <p>Loading...</p>
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
            <Link href="/doctor/dashboard" style={{ color: '#2563EB', fontSize: '1.125rem', fontWeight: '500', textDecoration: 'none' }}>
              Dashboard
            </Link>
            <button
              onClick={() => auth && auth.signOut()}
              style={{
                backgroundColor: '#dc2626',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
        {/* Create New Invitation - Full Width */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
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

          {selectedRoom && user && (
            <InvitationManager 
              user={user} 
              roomName={selectedRoom}
              onInvitationCreated={(invitationId) => {
                // After invitation is created, the real-time listener will update the list
                // Optionally scroll to show the new invitation
                setTimeout(() => {
                  const element = document.getElementById(`invitation-${invitationId}`);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }
                }, 500);
              }}
            />
          )}
        </div>

        {/* Two Column Layout: Created Invitations and Waiting Queue */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Created Invitations List */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
              Your Invitations
            </h2>
            <p style={{ color: '#6B7280', marginBottom: '1.5rem' }}>
              Manage your created invitations
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
                  Create your first invitation using the form above.
                </p>
              </div>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    id={`invitation-${invitation.id}`}
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
                          Patient: {invitation.emailAllowed || 'Open Invitation (No email required)'}
                        </p>
                        {invitation.waitingRoomEnabled && (
                          <p style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '500', marginTop: '0.25rem' }}>
                            🚪 Waiting Room Enabled (Max: {invitation.maxPatients || 10} patients)
                          </p>
                        )}
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
                      {invitation.waitingRoomEnabled ? (
                        <p><strong>Uses:</strong> {invitation.currentUses || 0} / {invitation.maxUses || 'Unlimited'}</p>
                      ) : (
                        <p><strong>Uses:</strong> {invitation.usedAt ? 1 : 0} / {invitation.maxUses || 1}</p>
                      )}
                      {invitation.emailAllowed ? (
                        <p><strong>Email:</strong> {invitation.emailAllowed}</p>
                      ) : (
                        <p><strong>Type:</strong> <span style={{ color: '#059669', fontWeight: '600' }}>Open Invitation</span> (No email required)</p>
                      )}
                      {invitation.phoneAllowed && (
                        <p><strong>Phone:</strong> {invitation.phoneAllowed}</p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {invitation.status === 'active' && (
                        <>
                          <button
                            onClick={() => {
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Waiting Queue Room */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
              Waiting Queue Room
            </h2>
            <p style={{ color: '#6B7280', marginBottom: '1.5rem' }}>
              View and manage patients waiting to join consultations
            </p>

          {loadingWaiting ? (
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
              <p style={{ color: '#6B7280' }}>Loading waiting patients...</p>
            </div>
          ) : waitingPatients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
              <p>No patients waiting.</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Patients with waiting room enabled invitations will appear here when they join.
              </p>
            </div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {waitingPatients.map((patient) => {
                const joinedAt = patient.joinedAt?.toDate ? patient.joinedAt.toDate() : 
                                 patient.joinedAt instanceof Date ? patient.joinedAt : 
                                 new Date(patient.joinedAt);
                const waitTime = Math.floor((Date.now() - joinedAt.getTime()) / 1000 / 60); // minutes
                const invitation = invitations.find(inv => inv.id === patient.invitationId);

                return (
                  <div
                    key={patient.id}
                    style={{
                      border: '1px solid #E5E7EB',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      marginBottom: '1rem',
                      backgroundColor: '#F9FAFB'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '0.25rem' }}>
                          Room: {patient.roomName}
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>
                          <strong>Email:</strong> {patient.patientEmail || 'Unknown'}
                        </p>
                        <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>
                          <strong>Name:</strong> {patient.patientName || 'Unknown'}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                          Waiting for {waitTime} minute{waitTime !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => admitPatient(patient)}
                        disabled={admittingId === patient.id}
                        style={{
                          backgroundColor: admittingId === patient.id ? '#9ca3af' : '#059669',
                          color: 'white',
                          padding: '0.5rem 1rem',
                          borderRadius: '0.375rem',
                          border: 'none',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          cursor: admittingId === patient.id ? 'not-allowed' : 'pointer',
                          flex: 1
                        }}
                      >
                        {admittingId === patient.id ? 'Admitting...' : '✅ Admit'}
                      </button>
                      <button
                        onClick={() => rejectPatient(patient.id)}
                        disabled={rejectingId === patient.id}
                        style={{
                          backgroundColor: rejectingId === patient.id ? '#9ca3af' : '#dc2626',
                          color: 'white',
                          padding: '0.5rem 1rem',
                          borderRadius: '0.375rem',
                          border: 'none',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          cursor: rejectingId === patient.id ? 'not-allowed' : 'pointer',
                          flex: 1
                        }}
                      >
                        {rejectingId === patient.id ? 'Removing...' : '❌ Reject'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
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


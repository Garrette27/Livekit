'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import InvitationManager from '@/components/InvitationManager';
import { Invitation } from '@/lib/types';
import WaitingPatientsList from './components/WaitingPatientsList';
import { useAuthSession } from '@/hooks/useAuthSession';
import { copyTextToClipboard, fetchInvitationLink as getInvitationLink } from '@/lib/invitations/invitation-link-client';
import { useToast } from '@/components/ui/feedback/ToastProvider';
import { getDoctorHistoryRoute } from '@/lib/routes/doctor-routes';

export default function DoctorInvitationsPage() {
  const { showToast } = useToast();
  const { user, isAuthenticated, isAuthorized, isLoading: authLoading } = useAuthSession({
    requiredRole: 'doctor',
  });
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [selectedInvitationId, setSelectedInvitationId] = useState<string | null>(null);
  const [invitationLinks, setInvitationLinks] = useState<Record<string, string>>({});
  const [loadingLinks, setLoadingLinks] = useState<Record<string, boolean>>({});
  const [linkErrors, setLinkErrors] = useState<Record<string, string>>({});
  const [waitingPatientsCounts, setWaitingPatientsCounts] = useState<Record<string, number>>({});
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(null);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const requestedInvitationLinksRef = useRef<Set<string>>(new Set());
  const router = useRouter();

  const navigateToConsultationHistory = useCallback(() => {
    const doctorHistoryRoute = getDoctorHistoryRoute();
    router.push(doctorHistoryRoute);
    window.setTimeout(() => {
      if (window.location.pathname !== doctorHistoryRoute) {
        window.location.assign(doctorHistoryRoute);
      }
    }, 250);
  }, [router]);

  useEffect(() => {
    if (!pendingRevokeId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPendingRevokeId(null);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [pendingRevokeId]);

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
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      router.push('/doctor/login');
      return;
    }

    if (!isAuthorized) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, isAuthorized, router]);

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
      
      // Fetch each active invitation link once per snapshot lifecycle.
      const activeInvitationIds = new Set(
        invitationData
          .filter((invitation) => {
            if (invitation.status !== 'active') {
              return false;
            }

            const expiresAt = invitation.expiresAt?.toDate
              ? invitation.expiresAt.toDate()
              : invitation.expiresAt instanceof Date
              ? invitation.expiresAt
              : null;

            return !expiresAt || expiresAt.getTime() > Date.now();
          })
          .map((invitation) => invitation.id)
      );

      requestedInvitationLinksRef.current.forEach((invitationId) => {
        if (!activeInvitationIds.has(invitationId)) {
          requestedInvitationLinksRef.current.delete(invitationId);
        }
      });

      invitationData.forEach((invitation) => {
        if (!activeInvitationIds.has(invitation.id)) {
          return;
        }

        if (requestedInvitationLinksRef.current.has(invitation.id)) {
          return;
        }

        requestedInvitationLinksRef.current.add(invitation.id);
        void fetchInvitationLink(invitation.id);
      });
    });

    return () => unsubscribe();
  }, [user, isAuthorized]);

  async function fetchInvitationLink(invitationId: string) {
    setLoadingLinks(prev => ({ ...prev, [invitationId]: true }));
    setLinkErrors(prev => ({ ...prev, [invitationId]: '' })); // Clear previous error
    try {
      const result = await getInvitationLink({ invitationId });
      const inviteUrl = result.inviteUrl;
      if (result.success && inviteUrl) {
        setInvitationLinks(prev => ({ ...prev, [invitationId]: inviteUrl }));
        setLinkErrors(prev => ({ ...prev, [invitationId]: '' })); // Clear error on success
      } else {
        console.error(`Failed to fetch link for invitation ${invitationId}:`, result.error);
        
        // Provide user-friendly error messages
        let errorMessage = 'Unable to load invitation link.';
        if (result.error) {
          if (result.error.includes('expired') || result.error.includes('Expired')) {
            errorMessage = 'This invitation has expired. Please create a new invitation to generate a new link.';
          } else if (result.error.includes('not active') || result.error.includes('not active')) {
            errorMessage = 'This invitation is no longer active. It may have been revoked or used.';
          } else {
            errorMessage = `Unable to load link: ${result.error}`;
          }
        }
        
        // Store error message to display in UI
        setLinkErrors(prev => ({ ...prev, [invitationId]: errorMessage }));
      }
    } catch (error) {
      console.error(`Error fetching link for invitation ${invitationId}:`, error);
      setLinkErrors(prev => ({ ...prev, [invitationId]: 'Network error. Please check your connection and try again.' }));
    } finally {
      setLoadingLinks(prev => ({ ...prev, [invitationId]: false }));
    }
  }

  const copyInvitationLink = async (invitationId: string, link: string) => {
    try {
      await copyTextToClipboard(link);
      setCopiedInvitationId(invitationId);
      window.setTimeout(() => {
        setCopiedInvitationId((currentValue) => (currentValue === invitationId ? null : currentValue));
      }, 1600);
      showToast({
        kind: 'success',
        title: 'Link copied',
        message: 'Invitation link copied to clipboard.',
      });
    } catch (error) {
      console.error('Error copying link:', error);
      showToast({
        kind: 'error',
        title: 'Copy failed',
        message: 'Failed to copy invitation link. Please try again.',
      });
    }
  };

  // Note: Waiting patients are now handled by WaitingPatientsList component

  const revokeInvitation = async (invitationId: string) => {
    if (!db) return;

    if (pendingRevokeId !== invitationId) {
      setPendingRevokeId(invitationId);
      showToast({
        kind: 'info',
        title: 'Confirm revoke',
        message: 'Click Revoke again within 5 seconds to confirm.',
      });
      return;
    }

    try {
      const invitationRef = doc(db, 'invitations', invitationId);
      await updateDoc(invitationRef, {
        status: 'revoked',
        revokedAt: new Date()
      });
      setPendingRevokeId(null);
      showToast({
        kind: 'success',
        title: 'Invitation revoked',
        message: 'Patients using this link will now be denied access.',
      });
    } catch (error) {
      console.error('Error revoking invitation:', error);
      showToast({
        kind: 'error',
        title: 'Revoke failed',
        message: 'Failed to revoke invitation.',
      });
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

  // Helper function to check if invitation is expired
  const isInvitationExpired = (invitation: Invitation): boolean => {
    if (!invitation.expiresAt) return false; // No expiration date means never expires
    
    let expiresAtDate: Date;
    if (invitation.expiresAt.toDate) {
      expiresAtDate = invitation.expiresAt.toDate();
    } else if (invitation.expiresAt instanceof Date) {
      expiresAtDate = invitation.expiresAt;
    } else {
      return false; // Can't determine expiration
    }
    
    return new Date() > expiresAtDate;
  };

  // Get effective status (checking expiration even if status is 'active')
  const getEffectiveStatus = (invitation: Invitation): string => {
    if (invitation.status === 'revoked' || invitation.status === 'used' || invitation.status === 'cancelled') {
      return invitation.status;
    }
    
    // If status is 'active' but invitation is expired, return 'expired'
    if (invitation.status === 'active' && isInvitationExpired(invitation)) {
      return 'expired';
    }
    
    return invitation.status;
  };

  if (authLoading || !isAuthenticated || !isAuthorized) {
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
            <button
              type="button"
              onClick={navigateToConsultationHistory}
              style={{
                backgroundColor: 'transparent',
                border: 0,
                padding: 0,
                color: '#2563EB',
                fontSize: '1.125rem',
                fontWeight: '500',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              Consultation History
            </button>
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
              <li><strong>Doctor:</strong> Uses the &apos;Join as Doctor&apos; button (no invitation needed)</li>
              <li><strong>Security:</strong> System automatically verifies patient&apos;s device, location, and browser after registration with consent</li>
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
                    onClick={(e) => {
                      // Don't trigger if clicking on buttons
                      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
                      setSelectedInvitationId(prev => 
                        prev === invitation.id ? null : invitation.id
                      );
                    }}
                    style={{
                      border: selectedInvitationId === invitation.id 
                        ? '2px solid #2563eb' 
                        : '1px solid #E5E7EB',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      marginBottom: '1rem',
                      backgroundColor: selectedInvitationId === invitation.id 
                        ? '#eff6ff' 
                        : '#F9FAFB',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
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
                            🚪 Waiting Room: {waitingPatientsCounts[invitation.id] ?? 0} / {invitation.maxPatients || 10} patients
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {(() => {
                          const effectiveStatus = getEffectiveStatus(invitation);
                          return (
                            <>
                              <span style={{ fontSize: '1.25rem' }}>
                                {getStatusIcon(effectiveStatus)}
                              </span>
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                color: getStatusColor(effectiveStatus),
                                textTransform: 'uppercase'
                              }}>
                                {effectiveStatus}
                              </span>
                            </>
                          );
                        })()}
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
                      
                      {/* Invitation Link Section */}
                      {getEffectiveStatus(invitation) === 'active' && (
                        <div style={{ 
                          marginTop: '0.75rem', 
                          padding: '0.5rem', 
                          backgroundColor: '#f0f9ff', 
                          border: '1px solid #bae6fd', 
                          borderRadius: '0.375rem' 
                        }}>
                          <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', fontSize: '0.75rem', color: '#1e40af' }}>
                            Invitation Link:
                          </p>
                          {loadingLinks[invitation.id] ? (
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#6b7280' }}>Loading link...</p>
                          ) : linkErrors[invitation.id] ? (
                            <div>
                              <p style={{ 
                                margin: '0 0 0.5rem 0', 
                                fontSize: '0.7rem', 
                                color: '#dc2626',
                                lineHeight: '1.4'
                              }}>
                                {linkErrors[invitation.id]}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetchInvitationLink(invitation.id);
                                }}
                                style={{
                                  backgroundColor: '#6b7280',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '0.25rem',
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.7rem',
                                  fontWeight: '500',
                                  cursor: 'pointer'
                                }}
                              >
                                Try Again
                              </button>
                            </div>
                          ) : invitationLinks[invitation.id] ? (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <p style={{ 
                                margin: 0, 
                                fontSize: '0.7rem', 
                                color: '#1e40af', 
                                wordBreak: 'break-all',
                                flex: 1
                              }}>
                                {invitationLinks[invitation.id]}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyInvitationLink(invitation.id, invitationLinks[invitation.id]);
                                }}
                                style={{
                                  backgroundColor: copiedInvitationId === invitation.id ? '#16a34a' : '#2563eb',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '0.25rem',
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.7rem',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  transform: copiedInvitationId === invitation.id ? 'translateY(1px) scale(0.98)' : 'none',
                                  transition: 'all 140ms ease'
                                }}
                                title="Copy link"
                              >
                                {copiedInvitationId === invitation.id ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchInvitationLink(invitation.id);
                              }}
                              style={{
                                backgroundColor: '#6b7280',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.25rem',
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.7rem',
                                fontWeight: '500',
                                cursor: 'pointer'
                              }}
                            >
                              Load Link
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {(() => {
                        const effectiveStatus = getEffectiveStatus(invitation);
                        if (effectiveStatus === 'active') {
                          return (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent card click
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
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent card click
                                  revokeInvitation(invitation.id);
                                }}
                                style={{
                                  backgroundColor: pendingRevokeId === invitation.id ? '#b91c1c' : '#dc2626',
                                  color: 'white',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '0.375rem',
                                  border: 'none',
                                  fontSize: '0.75rem',
                                  fontWeight: '500',
                                  cursor: 'pointer'
                                }}
                              >
                                {pendingRevokeId === invitation.id ? 'Confirm Revoke' : 'Revoke'}
                              </button>
                            </>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Waiting Queue Room / Invitation Details */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            {selectedInvitationId ? (
              <>
                {(() => {
                  const selectedInv = invitations.find(inv => inv.id === selectedInvitationId);
                  if (!selectedInv) return null;
                  
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.25rem' }}>
                            {selectedInv.roomName}
                          </h2>
                          <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
                            {selectedInv.emailAllowed || 'Open Invitation'}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedInvitationId(null)}
                          style={{
                            backgroundColor: '#f3f4f6',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.375rem',
                            padding: '0.25rem 0.75rem',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            color: '#6b7280'
                          }}
                        >
                          ✕ Close
                        </button>
                      </div>
                      
                      <div style={{ 
                        backgroundColor: '#f0f9ff', 
                        border: '1px solid #bae6fd', 
                        borderRadius: '0.5rem', 
                        padding: '1rem', 
                        marginBottom: '1.5rem',
                        fontSize: '0.875rem'
                      }}>
                        <p style={{ margin: '0 0 0.5rem 0' }}>
                          <strong>Status:</strong> {(() => {
                            const effectiveStatus = getEffectiveStatus(selectedInv);
                            return effectiveStatus;
                          })()}
                        </p>
                        <p style={{ margin: '0 0 0.5rem 0' }}><strong>Created:</strong> {selectedInv.createdAt?.toDate?.()?.toLocaleString() || 'Unknown'}</p>
                        <p style={{ margin: '0 0 0.5rem 0' }}><strong>Expires:</strong> {selectedInv.expiresAt?.toDate?.()?.toLocaleString() || 'Unknown'}</p>
                        {selectedInv.waitingRoomEnabled && (
                          <p style={{ margin: '0', color: '#059669', fontWeight: '500' }}>
                            🚪 Waiting Room: {waitingPatientsCounts[selectedInv.id] ?? 0} / {selectedInv.maxPatients || 10} patients
                          </p>
                        )}
                      </div>
                      
                      <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '1rem' }}>
                        Waiting Patients
                      </h3>
                    </>
                  );
                })()}
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
                  Waiting Queue Room
                </h2>
                <p style={{ color: '#6B7280', marginBottom: '1.5rem' }}>
                  Click on an invitation card to view its waiting patients, or view all waiting patients below
                </p>
              </>
            )}

          {user ? (
            <WaitingPatientsList
              user={user}
              invitations={invitations}
              selectedInvitationId={selectedInvitationId}
              onCountUpdate={(invitationId, count) => {
                setWaitingPatientsCounts(prev => ({ ...prev, [invitationId]: count }));
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
              <p>Loading...</p>
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


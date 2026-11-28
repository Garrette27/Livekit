'use client';

import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import InvitationManager from '@/components/InvitationManager';
import { Invitation } from '@/lib/types';
import WaitingPatientsList from './components/WaitingPatientsList';
import DoctorAppHeader from '@/components/doctor/DoctorAppHeader';
import WaitingLimitEditor from '@/components/doctor/WaitingLimitEditor';
import { useAuthSession } from '@/hooks/useAuthSession';
import { copyTextToClipboard, fetchInvitationLink as getInvitationLink } from '@/lib/invitations/invitation-link-client';
import { useToast } from '@/components/ui/feedback/ToastProvider';
import { getDoctorHistoryRoute } from '@/lib/routes/doctor-routes';
import { authenticatedFetch } from '@/lib/auth/authenticated-fetch';
import { compactInvitationUrl } from '@/lib/invitations/invitation-link-display';
import {
  countDirectAdmissionIdentities,
  describeInvitationAudience,
  formatExpiryCountdown,
  formatInvitationUsage,
  formatVisitBreakdown,
  resolveInvitationStatusPresentation,
} from '@/lib/invitations/invitation-presentation';
import { parseInvitationRoomHandoff } from '@/lib/appointments/appointment-policy';

const INVITATIONS_PER_PAGE = 12;

export default function DoctorInvitationsPage() {
  const { showToast } = useToast();
  const { user, isAuthenticated, isAuthorized, isLoading: authLoading } = useAuthSession({
    requiredRole: 'doctor',
  });
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [selectedInvitationId, setSelectedInvitationId] = useState<string | null>(null);
  // The detail pane sits beside the list on wide screens (sticky, so it is in
  // view wherever the doctor scrolled) and below it on narrow screens, where
  // selecting an invitation scrolls the pane into view.
  const detailPaneRef = useRef<HTMLDivElement | null>(null);
  const toggleInvitationDetail = (invitationId: string) => {
    setSelectedInvitationId((current) => (current === invitationId ? null : invitationId));
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches) {
      window.requestAnimationFrame(() => detailPaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };
  const [invitationLinks, setInvitationLinks] = useState<Record<string, string>>({});
  const [loadingLinks, setLoadingLinks] = useState<Record<string, boolean>>({});
  const [linkErrors, setLinkErrors] = useState<Record<string, string>>({});
  const [waitingPatientsCounts, setWaitingPatientsCounts] = useState<Record<string, number>>({});
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(null);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  // Defaults to the invitations a doctor can still act on; expired and revoked
  // links are history and would otherwise bury the usable ones.
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [visibleInvitationLimit, setVisibleInvitationLimit] = useState(INVITATIONS_PER_PAGE);
  const requestedInvitationLinksRef = useRef<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    if (!pendingRevokeId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPendingRevokeId(null);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [pendingRevokeId]);

  useEffect(() => {
    setVisibleInvitationLimit(INVITATIONS_PER_PAGE);
  }, [statusFilter]);

  // Persist room name in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // An appointment's "Prepare invitation" handoff wins over the last room used.
      const handoffRoom = parseInvitationRoomHandoff(window.location.search);
      const savedRoom = handoffRoom || localStorage.getItem('doctor_selected_room');
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
      const response = await authenticatedFetch('/api/invite/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to revoke invitation');
      }
      setPendingRevokeId(null);
      showToast({
        kind: 'success',
        title: 'Invitation revoked',
        message: result.finalization?.finalDurationMinutes
          ? `Patients are denied. Final duration: ${result.finalization.finalDurationMinutes} minute(s).`
          : 'Patients using this link will now be denied access.',
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

  const activeInvitationCount = invitations.filter(
    (invitation) => getEffectiveStatus(invitation) === 'active'
  ).length;

  const filteredInvitations = invitations.filter((invitation) => {
    if (statusFilter === 'all') {
      return true;
    }
    const isActive = getEffectiveStatus(invitation) === 'active';
    return statusFilter === 'active' ? isActive : !isActive;
  });
  const visibleInvitations = filteredInvitations.slice(0, visibleInvitationLimit);

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
      <div style={{ marginBottom: '2rem', borderRadius: '0.75rem', overflow: 'hidden' }}>
        <DoctorAppHeader
          title="Invitation Management"
          subtitle="Create and manage secure patient invitations"
          user={user}
          navLink={{ href: getDoctorHistoryRoute(), label: 'Consultation History' }}
        />
      </div>

      <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
        {/* Create New Invitation - Full Width */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: 'var(--card-padding)', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
            Create New Invitation
          </h2>
          
          {/* Collapsed by default: this is onboarding guidance, and a doctor who
              already knows the flow should not have to read past it every visit. */}
          <details style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '0.5rem',
            padding: '0.5rem 0.875rem',
            marginBottom: '1rem'
          }}>
            <summary style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e40af', cursor: 'pointer' }}>
              How invitations work
            </summary>
            <ul style={{ fontSize: '0.875rem', color: '#1e40af', margin: '0.75rem 0 0', paddingLeft: '1.25rem', lineHeight: '1.75' }}>
              <li><strong>Configure:</strong> Choose the room, expiry, queue capacity, and optional verified-email allowlist.</li>
              <li><strong>Share:</strong> Send the first-party secure link through a trusted channel.</li>
              <li><strong>Admit:</strong> Allowlisted, verified accounts may join directly; every other visitor waits for your decision.</li>
              <li><strong>Control:</strong> Revoke the link at any time. The system validates expiry, status, room binding, and capacity on the server.</li>
            </ul>
          </details>
          
          {user && (
            <InvitationManager
              user={user}
              roomName={selectedRoom}
              onRoomNameChange={setSelectedRoom}
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
        <div className="invitation-columns">
          {/* Created Invitations List */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: 'var(--card-padding)', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
              Your Invitations
            </h2>

            <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              {([
                { value: 'active' as const, label: `Active (${activeInvitationCount})` },
                { value: 'inactive' as const, label: `Expired & revoked (${invitations.length - activeInvitationCount})` },
                { value: 'all' as const, label: `All (${invitations.length})` },
              ]).map((filter) => {
                const isActive = statusFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    onClick={() => setStatusFilter(filter.value)}
                    aria-pressed={isActive}
                    style={{
                      padding: '0.375rem 0.75rem',
                      borderRadius: '0.375rem',
                      border: `1px solid ${isActive ? '#2563eb' : '#d1d5db'}`,
                      backgroundColor: isActive ? '#eff6ff' : '#ffffff',
                      color: isActive ? '#1d4ed8' : '#4b5563',
                      fontSize: '0.8125rem',
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

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
            ) : visibleInvitations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
                {invitations.length === 0 ? (
                  <>
                    <p>No invitations created yet.</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                      Create your first invitation using the form above.
                    </p>
                  </>
                ) : (
                  <p>
                    {statusFilter === 'active'
                      ? 'No active invitations. Create one above to invite a patient.'
                      : 'No invitations in this category.'}
                  </p>
                )}
              </div>
            ) : (
              <div>
                {visibleInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    id={`invitation-${invitation.id}`}
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
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '0.25rem' }}>
                          Room: {invitation.roomName}
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                          Direct join: {(() => {
                            const identityCount = countDirectAdmissionIdentities(invitation);
                            return identityCount > 0
                              ? `${identityCount} verified account${identityCount === 1 ? '' : 's'}`
                              : 'None — doctor admits every visitor';
                          })()}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '0.25rem' }}>
                          {describeInvitationAudience(countDirectAdmissionIdentities(invitation))}
                        </p>
                        {invitation.waitingRoomEnabled && (
                          <p style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '500', marginTop: '0.25rem' }}>
                            Waiting Room: {waitingPatientsCounts[invitation.id] ?? 0} / {invitation.maxPatients || 10} patients
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {(() => {
                          const presentation = resolveInvitationStatusPresentation(
                            getEffectiveStatus(invitation)
                          );
                          return (
                            <span style={{
                              padding: '0.125rem 0.625rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: presentation.color,
                              backgroundColor: presentation.background,
                              whiteSpace: 'nowrap',
                            }}>
                              {presentation.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '0.75rem' }}>
                      {/* Validity is the decision the doctor is making, so it leads
                          and is phrased as remaining time rather than a timestamp. */}
                      <p style={{ margin: '0 0 0.25rem', fontWeight: 600, color: '#374151' }}>
                        {formatExpiryCountdown(invitation.expiresAt?.toDate?.() || null) || 'Expiry unknown'}
                        {' · '}
                        {formatInvitationUsage({
                          currentUses: invitation.currentUses,
                          maxUses: invitation.maxUses,
                          waitingRoomEnabled: invitation.waitingRoomEnabled,
                          usedAt: invitation.usedAt,
                          usagePolicy: invitation.metadata?.security?.usagePolicy,
                        })}
                      </p>
                      {formatVisitBreakdown(invitation.visitStats) && (
                        <p style={{ margin: '0 0 0.25rem', color: '#374151' }}>
                          {formatVisitBreakdown(invitation.visitStats)}
                        </p>
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
                                flex: 1
                              }}>
                                {compactInvitationUrl(invitationLinks[invitation.id])}
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
                      <button
                        type="button"
                        onClick={() => toggleInvitationDetail(invitation.id)}
                        aria-expanded={selectedInvitationId === invitation.id}
                        style={{
                          backgroundColor: selectedInvitationId === invitation.id ? '#1d4ed8' : '#ffffff',
                          color: selectedInvitationId === invitation.id ? '#ffffff' : '#1d4ed8',
                          padding: '0.5rem 1rem',
                          borderRadius: '0.375rem',
                          border: '1px solid #2563eb',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        {getEffectiveStatus(invitation) === 'active'
                          ? (selectedInvitationId === invitation.id ? 'Hide queue' : 'View queue')
                          : (selectedInvitationId === invitation.id ? 'Hide details' : 'View details')}
                      </button>
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
                                Join as Doctor
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
                {visibleInvitations.length < filteredInvitations.length && (
                  <button
                    type="button"
                    onClick={() => setVisibleInvitationLimit((current) => current + INVITATIONS_PER_PAGE)}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      backgroundColor: '#ffffff',
                      color: '#374151',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Show {Math.min(INVITATIONS_PER_PAGE, filteredInvitations.length - visibleInvitations.length)} more
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Waiting Queue Room / Invitation Details */}
          <div ref={detailPaneRef} className="invitation-detail-pane" style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: 'var(--card-padding)', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            {selectedInvitationId ? (
              <>
                {(() => {
                  const selectedInv = invitations.find(inv => inv.id === selectedInvitationId);
                  if (!selectedInv) return null;
                  const selectedStatus = getEffectiveStatus(selectedInv);
                  const queueIsLive = selectedStatus === 'active';
                  
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.25rem' }}>
                            {selectedInv.roomName}
                          </h2>
                          <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
                            {(() => {
                              const identityCount = countDirectAdmissionIdentities(selectedInv);
                              return identityCount > 0
                                ? `${identityCount} verified direct-join account${identityCount === 1 ? '' : 's'}`
                                : 'Doctor-admitted invitation';
                            })()}
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
                          Close
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
                        {selectedInv.waitingRoomEnabled && queueIsLive && (
                          <p style={{ margin: '0', color: '#059669', fontWeight: '500' }}>
                            Waiting Room: {waitingPatientsCounts[selectedInv.id] ?? 0} / {selectedInv.maxPatients || 10} patients
                          </p>
                        )}
                        {formatVisitBreakdown(selectedInv.visitStats) && (
                          <p style={{ margin: '0.5rem 0 0' }}><strong>Visits:</strong> {formatVisitBreakdown(selectedInv.visitStats)}</p>
                        )}
                        {selectedInv.waitingRoomEnabled && queueIsLive && (
                          <WaitingLimitEditor invitationId={selectedInv.id} current={selectedInv.maxPatients || 10} />
                        )}
                      </div>
                      
                      {queueIsLive ? (
                        <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '1rem' }}>
                          Waiting Patients
                        </h3>
                      ) : (
                        <div role="status" style={{ border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: '0.5rem', padding: '1rem', color: '#374151', fontSize: '0.875rem' }}>
                          <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
                            Queue closed — this invitation is {selectedStatus}.
                          </strong>
                          Nobody can wait or join with this link any more, so there is no live queue to show.
                          Past visits are in Consultation History. Create a new invitation to see patients again.
                        </div>
                      )}
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

          {user && selectedInvitationId && (() => {
            const selected = invitations.find((inv) => inv.id === selectedInvitationId);
            return selected ? getEffectiveStatus(selected) !== 'active' : false;
          })() ? null : user ? (
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
        .invitation-columns {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 2rem;
        }

        .invitation-detail-pane {
          position: sticky;
          top: 1rem;
          align-self: start;
        }

        @media (max-width: 900px) {
          .invitation-columns {
            grid-template-columns: 1fr;
          }
          .invitation-detail-pane {
            position: static;
          }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

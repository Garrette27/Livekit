'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Firestore } from 'firebase/firestore';
import { WaitingPatient, Invitation } from '@/lib/types';
import { User } from 'firebase/auth';

interface WaitingPatientsListProps {
  db: Firestore;
  user: User;
  invitations: Invitation[];
  selectedInvitationId: string | null;
  onAdmit: (patient: WaitingPatient) => Promise<void>;
  onReject: (patientId: string) => Promise<void>;
  admittingId: string | null;
  rejectingId: string | null;
}

export default function WaitingPatientsList({
  db,
  user,
  invitations,
  selectedInvitationId,
  onAdmit,
  onReject,
  admittingId,
  rejectingId
}: WaitingPatientsListProps) {
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !db) {
      setWaitingPatients([]);
      return;
    }

    setLoading(true);
    setError(null);

    // Get active invitations for this doctor
    const activeInvitations = invitations.filter(inv => 
      inv.status === 'active' && 
      inv.waitingRoomEnabled === true && 
      inv.createdBy === user.uid
    );

    // Debug: Check if there are invitations with waiting room but wrong createdBy
    const allWaitingRoomInvitations = invitations.filter(inv => 
      inv.status === 'active' && inv.waitingRoomEnabled === true
    );
    
    if (allWaitingRoomInvitations.length > 0 && activeInvitations.length === 0) {
      console.warn('⚠️ Found waiting room invitations but none match user.uid:', {
        userUid: user.uid,
        allWaitingRoomInvitations: allWaitingRoomInvitations.map(inv => ({
          id: inv.id,
          createdBy: inv.createdBy,
          matches: inv.createdBy === user.uid
        }))
      });
    }

    if (activeInvitations.length === 0) {
      setWaitingPatients([]);
      setLoading(false);
      return;
    }

    const invitationIds = activeInvitations.map(inv => inv.id);

    console.log('Setting up waiting patients query:', {
      userUid: user.uid,
      activeInvitationIds: invitationIds,
      selectedInvitationId,
      activeInvitations: activeInvitations.map(inv => ({
        id: inv.id,
        createdBy: inv.createdBy,
        roomName: inv.roomName,
        matchesUser: inv.createdBy === user.uid
      }))
    });
    
    // Log detailed comparison
    activeInvitations.forEach(inv => {
      if (inv.createdBy !== user.uid) {
        console.error('❌ INVITATION MISMATCH:', {
          invitationId: inv.id,
          invitationCreatedBy: inv.createdBy,
          currentUserUid: user.uid,
          match: inv.createdBy === user.uid
        });
      } else {
        console.log('✅ Invitation matches user:', {
          invitationId: inv.id,
          createdBy: inv.createdBy,
          userUid: user.uid
        });
      }
    });

    // Query all waiting patients for this doctor
    const waitingQuery = query(
      collection(db, 'waitingPatients'),
      where('doctorUserId', '==', user.uid),
      where('status', '==', 'waiting')
    );

    console.log('Query object:', waitingQuery);

    const unsubscribe = onSnapshot(
      waitingQuery,
      (snapshot) => {
        console.log('✅ Waiting patients snapshot received:', {
          size: snapshot.size,
          userUid: user.uid,
          empty: snapshot.empty
        });

        if (snapshot.empty) {
          console.log('⚠️ Snapshot is empty - no waiting patients found for this doctor');
        }

        const allPatients = snapshot.docs.map((doc) => {
          const data = doc.data();
          const matchesUser = data.doctorUserId === user.uid;
          console.log('📋 Waiting patient document:', {
            id: doc.id,
            invitationId: data.invitationId,
            doctorUserId: data.doctorUserId,
            userUid: user.uid,
            matchesUser: matchesUser,
            status: data.status,
            patientName: data.patientName,
            roomName: data.roomName
          });
          
          if (!matchesUser) {
            console.error('❌ MISMATCH: doctorUserId does not match user.uid!', {
              doctorUserId: data.doctorUserId,
              userUid: user.uid,
              invitationId: data.invitationId
            });
          }
          
          return {
            id: doc.id,
            ...data
          } as WaitingPatient;
        });

        // Filter by invitationId(s) in JavaScript
        let filteredPatients: WaitingPatient[];
        if (selectedInvitationId) {
          filteredPatients = allPatients.filter(p => p.invitationId === selectedInvitationId);
        } else {
          filteredPatients = allPatients.filter(p => invitationIds.includes(p.invitationId));
        }

        // Sort by joinedAt time
        const sorted = filteredPatients.sort((a, b) => {
          const aTime = a.joinedAt?.toMillis?.() || 
                       (a.joinedAt instanceof Date ? a.joinedAt.getTime() : 
                        (a.joinedAt ? new Date(a.joinedAt as any).getTime() : 0));
          const bTime = b.joinedAt?.toMillis?.() || 
                       (b.joinedAt instanceof Date ? b.joinedAt.getTime() : 
                        (b.joinedAt ? new Date(b.joinedAt as any).getTime() : 0));
          return aTime - bTime;
        });

        console.log('Filtered and sorted waiting patients:', {
          total: allPatients.length,
          filtered: filteredPatients.length,
          sorted: sorted.length
        });

        setWaitingPatients(sorted);
        setLoading(false);
        setError(null);
      },
      (error: any) => {
        console.error('❌ Error fetching waiting patients:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          stack: error.stack,
          userUid: user.uid,
          activeInvitationIds: invitationIds,
          activeInvitationsCreatedBy: activeInvitations.map(inv => ({
            id: inv.id,
            createdBy: inv.createdBy,
            matchesUser: inv.createdBy === user.uid
          }))
        });
        
        setError(error.message || 'Failed to fetch waiting patients');
        setLoading(false);
        
        if (error?.code === 'permission-denied') {
          console.error('🔒 Permission denied - possible causes:');
          console.error('1. doctorUserId in waiting patient document does not match user.uid');
          console.error('2. Firestore security rules are blocking the query');
          console.error('3. The invitation createdBy field does not match user.uid');
          console.error('Current user UID:', user.uid);
          console.error('Active invitations createdBy:', activeInvitations.map(inv => inv.createdBy));
        }
        
        if (error?.code === 'failed-precondition') {
          console.error('📋 Index required. Check the error message for a link to create the index.');
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [db, user, invitations, selectedInvitationId]);

  if (loading) {
    return (
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
    );
  }

  if (error) {
    return (
      <div style={{ 
        backgroundColor: '#fef2f2', 
        border: '1px solid #fecaca', 
        borderRadius: '0.5rem', 
        padding: '1rem', 
        marginBottom: '1rem',
        color: '#dc2626',
        fontSize: '0.875rem'
      }}>
        <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600' }}>Error loading waiting patients:</p>
        <p style={{ margin: 0 }}>{error}</p>
        {error.includes('permission') && (
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem' }}>
            Check browser console for details. Make sure you're logged in as the doctor who created the invitation.
          </p>
        )}
      </div>
    );
  }

  if (waitingPatients.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
        <p>{selectedInvitationId ? 'No patients waiting for this invitation.' : 'No patients waiting.'}</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
          {selectedInvitationId 
            ? 'Patients will appear here when they join using this invitation link.'
            : 'Click on an invitation card to view its waiting patients, or they will appear here when they join.'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
      {waitingPatients.map((patient) => {
        const joinedAt = patient.joinedAt?.toDate ? patient.joinedAt.toDate() : 
                         patient.joinedAt instanceof Date ? patient.joinedAt : 
                         new Date(patient.joinedAt);
        const waitTime = Math.floor((Date.now() - joinedAt.getTime()) / 1000 / 60); // minutes

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
                <p style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '0.25rem' }}>
                  <strong>Joined:</strong> {joinedAt.toLocaleString()}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                  Waiting for {waitTime} minute{waitTime !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => onAdmit(patient)}
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
                onClick={() => onReject(patient.id)}
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
  );
}


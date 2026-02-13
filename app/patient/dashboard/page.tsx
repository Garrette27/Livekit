'use client';
import { useCallback, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { collection, onSnapshot, query, Timestamp, where, limit, doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/hooks/useAuthSession';
import {
  getPendingConsultationSessionIds,
  removePendingConsultationSessionIds,
} from '@/lib/consultations/pending-session-client';

// Component for joining with invitation link
function JoinWithInvitationLink() {
  const [invitationLink, setInvitationLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleJoin = () => {
    if (!invitationLink.trim()) {
      setError('Please enter an invitation link');
      return;
    }

    // Extract token from the full URL or just use the token part
    let token = invitationLink.trim();
    
    // If it's a full URL, extract the token part
    if (token.includes('/invite/')) {
      const parts = token.split('/invite/');
      if (parts.length > 1) {
        token = parts[1].split('?')[0]; // Remove query params if any
      }
    }

    if (!token) {
      setError('Invalid invitation link format');
      return;
    }

    // Navigate to the invitation page
    router.push(`/invite/${token}`);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <input
          type="text"
          value={invitationLink}
          onChange={(e) => {
            setInvitationLink(e.target.value);
            setError(null);
          }}
          placeholder="Paste invitation link here (e.g., https://.../invite/eyJhbGc...)"
          style={{
            flex: 1,
            padding: '0.75rem',
            border: error ? '1px solid #dc2626' : '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '0.875rem'
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleJoin();
            }
          }}
        />
        <button
          onClick={handleJoin}
          style={{
            backgroundColor: '#059669',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '0.875rem',
            whiteSpace: 'nowrap'
          }}
        >
          Join Consultation
        </button>
      </div>
      {error && (
        <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
          {error}
        </p>
      )}
      <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.5rem' }}>
        💡 You can paste the full invitation link or just the token part
      </p>
    </div>
  );
}

export const dynamic = 'force-dynamic';

interface CallSummary {
  id: string;
  roomName: string;
  summary?: string; // Optional - patients don't see AI summaries
  keyPoints?: string[]; // Optional - patients don't see AI summaries
  recommendations?: string[]; // Optional - patients don't see AI summaries
  followUpActions?: string[]; // Optional - patients don't see AI summaries
  riskLevel?: string; // Optional - patients don't see AI summaries
  category?: string; // Optional - patients don't see AI summaries
  createdAt: Timestamp | Date;
  participants: string[];
  duration: number;
  metadata?: {
    totalParticipants: number;
    createdBy?: string;
    patientUserId?: string;
    visibleToUsers?: string[];
  };
  createdBy?: string;
  patientUserId?: string;
  doctorEmail?: string;
  patientEmail?: string;
}

export default function PatientDashboard() {
  const router = useRouter();

  const handleAuthenticated = useCallback(async (authenticatedUser: User) => {
    try {
      const pendingSessionIds = getPendingConsultationSessionIds();
      const response = await fetch('/api/link-patient-consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authenticatedUser.uid,
          userEmail: authenticatedUser.email,
          pendingSessionIds,
        }),
      });
      if (response.ok && pendingSessionIds.length > 0) {
        removePendingConsultationSessionIds(pendingSessionIds);
      }
      console.log('Linked patient consultations');
    } catch (error) {
      console.error('Error linking consultations:', error);
    }
  }, []);

  const {
    user,
    isAuthenticated,
    isAuthorized,
    isLoading: authLoading,
  } = useAuthSession({
    requiredRole: 'patient',
    onAuthenticated: handleAuthenticated,
  });

  const [summaries, setSummaries] = useState<CallSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [deletingSummary, setDeletingSummary] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (isAuthenticated && !isAuthorized) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, isAuthorized, router]);

  // Helper function to fetch user email
  const fetchUserEmail = async (userId: string | undefined): Promise<string | null> => {
    if (!userId || !db || userId === 'anonymous' || userId === 'unknown') return null;
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.email || null;
      }
    } catch (error) {
      console.error('Error fetching user email:', error);
    }
    return null;
  };

  const handleDelete = async (summary: CallSummary) => {
    if (!user) return;
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete the consultation "${summary.roomName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingSummary(summary.id);
    setDeleteError(null);

    try {
      // Get Firebase ID token for authentication
      const token = await user.getIdToken();

      const response = await fetch(`/api/summary/delete?id=${encodeURIComponent(summary.id)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete consultation');
      }

      // Consultation will be removed from the list automatically by Firestore listener
      console.log('Consultation deleted successfully');
    } catch (error) {
      console.error('Error deleting consultation:', error);
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete consultation');
    } finally {
      setDeletingSummary(null);
    }
  };

  useEffect(() => {
    if (!user || !db || !isAuthorized) {
      setLoading(false);
      return;
    }

    const summariesRef = collection(db, 'call-summaries');
    const byPatientUserIdQuery = query(
      summariesRef,
      where('patientUserId', '==', user.uid),
      limit(200)
    );
    const byMetadataPatientUserIdQuery = query(
      summariesRef,
      where('metadata.patientUserId', '==', user.uid),
      limit(200)
    );

    let directMatches: CallSummary[] = [];
    let metadataMatches: CallSummary[] = [];

    const sortByCreatedAt = (items: CallSummary[]) =>
      [...items].sort((left, right) => {
        const leftMillis =
          left.createdAt instanceof Date
            ? left.createdAt.getTime()
            : left.createdAt?.toDate?.().getTime() || 0;
        const rightMillis =
          right.createdAt instanceof Date
            ? right.createdAt.getTime()
            : right.createdAt?.toDate?.().getTime() || 0;
        return sortOrder === 'desc' ? rightMillis - leftMillis : leftMillis - rightMillis;
      });

    const refreshSummaries = async () => {
      const mergedById = new Map<string, CallSummary>();
      [...directMatches, ...metadataMatches].forEach((summary) => {
        mergedById.set(summary.id, summary);
      });

      const hydratedSummaries = await Promise.all(
        Array.from(mergedById.values()).map(async (summary) => {
          const doctorUserId = summary.createdBy || summary.metadata?.createdBy;
          const patientUserId =
            summary.patientUserId || summary.metadata?.patientUserId || user.uid;

          const doctorEmail =
            summary.doctorEmail || (await fetchUserEmail(doctorUserId)) || undefined;
          const patientEmail =
            summary.patientEmail || (await fetchUserEmail(patientUserId)) || undefined;

          return {
            ...summary,
            roomName: summary.roomName || 'Unknown Room',
            duration: Number(summary.duration || 0),
            createdBy: doctorUserId,
            patientUserId,
            doctorEmail,
            patientEmail,
          } as CallSummary;
        })
      );

      setSummaries(sortByCreatedAt(hydratedSummaries));
      setLoading(false);
    };

    const unsubscribeByPatientUserId = onSnapshot(
      byPatientUserIdQuery,
      async (snapshot) => {
        directMatches = snapshot.docs.map((summaryDoc) => ({
          id: summaryDoc.id,
          ...summaryDoc.data(),
        })) as CallSummary[];
        await refreshSummaries();
      },
      (snapshotError) => {
        console.error('Error fetching patient summaries (patientUserId):', snapshotError);
        setLoading(false);
      }
    );

    const unsubscribeByMetadataPatientUserId = onSnapshot(
      byMetadataPatientUserIdQuery,
      async (snapshot) => {
        metadataMatches = snapshot.docs.map((summaryDoc) => ({
          id: summaryDoc.id,
          ...summaryDoc.data(),
        })) as CallSummary[];
        await refreshSummaries();
      },
      (snapshotError) => {
        console.error(
          'Error fetching patient summaries (metadata.patientUserId):',
          snapshotError
        );
        setLoading(false);
      }
    );

    return () => {
      unsubscribeByPatientUserId();
      unsubscribeByMetadataPatientUserId();
    };
  }, [isAuthorized, sortOrder, user]);

  if (authLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            border: '2px solid #dcfce7',
            borderTop: '2px solid #059669',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1.5rem'
          }}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f0fdf4',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '3rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          textAlign: 'center',
          maxWidth: '32rem'
        }}>
          <div style={{
            width: '5rem',
            height: '5rem',
            backgroundColor: '#dcfce7',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 2rem'
          }}>
            <span style={{ fontSize: '2.5rem' }}>👤</span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#166534', marginBottom: '1rem' }}>
            Patient Portal
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '2rem', lineHeight: '1.6' }}>
            Sign in to view your consultation history, or use an invitation link to join a consultation directly.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Link
              href="/patient/login"
              style={{
                display: 'inline-block',
                backgroundColor: '#059669',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                fontWeight: '600',
                textDecoration: 'none',
                textAlign: 'center'
              }}
            >
              Sign In to View History
            </Link>
            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Don&apos;t have an account? You can join consultations using invitation links from your doctor.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            border: '2px solid #dcfce7',
            borderTop: '2px solid #059669',
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f0fdf4' }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #bbf7d0',
        padding: '1rem 2rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#166534' }}>
              Patient Dashboard
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Welcome, {user?.displayName || user?.email}
            </p>
          </div>
          <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
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
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem' }}>
        {/* Join with Invitation Link Section */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '2rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
            Join Consultation
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Enter the invitation link provided by your doctor to join a consultation
          </p>
          <JoinWithInvitationLink />
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '2rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827' }}>
              My Consultation History
            </h2>
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Sort: {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                border: '2px solid #dcfce7',
                borderTop: '2px solid #059669',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }}></div>
              <p style={{ marginTop: '1rem', color: '#6b7280' }}>Loading consultations...</p>
            </div>
          ) : summaries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No consultations yet</p>
              <p>Your consultation history will appear here after video calls with your doctor.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {summaries.map((summary) => (
                <div
                  key={summary.id}
                  style={{
                    border: '1px solid #bbf7d0',
                    borderRadius: '0.5rem',
                    padding: '1.5rem',
                    backgroundColor: '#f0fdf4'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#166534', marginBottom: '0.5rem' }}>
                        Consultation: {summary.roomName}
                      </h3>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                        {summary.createdAt instanceof Date ? summary.createdAt.toLocaleString() :
                         (summary.createdAt && typeof summary.createdAt === 'object' && 'toDate' in summary.createdAt ?
                          (summary.createdAt as any).toDate().toLocaleString() : 'Unknown date')}
                      </p>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {summary.doctorEmail && (
                          <span>👨‍⚕️ Doctor: <strong>{summary.doctorEmail}</strong></span>
                        )}
                        {summary.patientEmail && (
                          <span>👤 Patient: <strong>{summary.patientEmail}</strong></span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {summary.duration !== undefined && summary.duration !== null && (
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          backgroundColor: '#dcfce7',
                          color: '#166534'
                        }}>
                          {summary.duration} min
                        </span>
                      )}
                      <button
                        onClick={() => handleDelete(summary)}
                        disabled={deletingSummary === summary.id}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: deletingSummary === summary.id ? '#9ca3af' : '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: deletingSummary === summary.id ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          whiteSpace: 'nowrap',
                          opacity: deletingSummary === summary.id ? 0.6 : 1
                        }}
                      >
                        {deletingSummary === summary.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                  {deleteError && summary.id === deletingSummary && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.75rem',
                      backgroundColor: '#fee2e2',
                      border: '1px solid #fca5a5',
                      borderRadius: '0.375rem',
                      color: '#991b1b',
                      fontSize: '0.875rem'
                    }}>
                      Error: {deleteError}
                    </div>
                  )}
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                    {summary.duration !== undefined && summary.duration !== null ? (
                      <p>Duration: {summary.duration} minute{summary.duration !== 1 ? 's' : ''}</p>
                    ) : (
                      <p>Session completed</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}


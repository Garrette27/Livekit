'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query, Timestamp, where, limit } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isPatient, getUserProfile } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

interface CallSummary {
  id: string;
  roomName: string;
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  followUpActions: string[];
  riskLevel: string;
  category: string;
  createdAt: Timestamp;
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
}

export default function PatientDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [summaries, setSummaries] = useState<CallSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();

  // Handle authentication and role check
  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setUser(user);
        if (user) {
          const patient = await isPatient(user);
          setIsAuthorized(patient);
          if (!patient) {
            // Not a patient, redirect
            router.push('/');
          }
        } else {
          // Not logged in, show message (patients can still use invitation links)
          setIsAuthorized(false);
        }
      });
      return unsubscribe;
    }
  }, [router]);

  useEffect(() => {
    if (!user || !db || !isAuthorized) {
      setLoading(false);
      return;
    }

    // Fetch summaries where patient is a participant
    // Try multiple query strategies to find patient's consultations
    const summariesRef = collection(db, 'call-summaries');
    
    // Query 1: By visibleToUsers array
    const q1 = query(
      summariesRef,
      where('metadata.visibleToUsers', 'array-contains', user.uid),
      orderBy('createdAt', sortOrder),
      limit(100)
    );

    // Query 2: By patientUserId (if exists)
    const q2 = query(
      summariesRef,
      where('patientUserId', '==', user.uid),
      orderBy('createdAt', sortOrder),
      limit(100)
    );

    // Also fetch consultations to show session history
    const consultationsRef = collection(db, 'consultations');
    const consultationsQuery = query(
      consultationsRef,
      where('metadata.visibleToUsers', 'array-contains', user.uid),
      orderBy('joinedAt', sortOrder),
      limit(100)
    );

    // Combine results from both queries
    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      const summaryData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CallSummary[];
      setSummaries(prev => {
        const combined = [...prev, ...summaryData];
        // Remove duplicates
        const unique = combined.filter((item, index, self) => 
          index === self.findIndex(t => t.id === item.id)
        );
        return unique.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
          const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
          return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
        });
      });
      setLoading(false);
    }, (error) => {
      console.error('Error fetching summaries:', error);
      setLoading(false);
    });

    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      const summaryData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CallSummary[];
      setSummaries(prev => {
        const combined = [...prev, ...summaryData];
        const unique = combined.filter((item, index, self) => 
          index === self.findIndex(t => t.id === item.id)
        );
        return unique.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
          const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
          return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
        });
      });
    }, (error) => {
      console.error('Error fetching summaries by patientUserId:', error);
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [user, sortOrder, isAuthorized]);

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
              Don't have an account? You can join consultations using invitation links from your doctor.
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
              <p>Your consultation summaries will appear here after video calls with your doctor.</p>
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
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#166534', marginBottom: '0.5rem' }}>
                        Consultation: {summary.roomName}
                      </h3>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {summary.createdAt?.toDate?.()?.toLocaleString() || 'Unknown date'}
                      </p>
                    </div>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      backgroundColor: summary.riskLevel === 'High' ? '#fef2f2' : summary.riskLevel === 'Medium' ? '#fef3c7' : '#dcfce7',
                      color: summary.riskLevel === 'High' ? '#dc2626' : summary.riskLevel === 'Medium' ? '#d97706' : '#166534'
                    }}>
                      {summary.riskLevel}
                    </span>
                  </div>
                  <p style={{ color: '#374151', marginBottom: '1rem', lineHeight: '1.6' }}>
                    {summary.summary}
                  </p>
                  {summary.keyPoints && summary.keyPoints.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#166534', marginBottom: '0.5rem' }}>
                        Key Points:
                      </h4>
                      <ul style={{ fontSize: '0.875rem', color: '#6b7280', paddingLeft: '1.25rem' }}>
                        {summary.keyPoints.map((point, idx) => (
                          <li key={idx} style={{ marginBottom: '0.25rem' }}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {summary.recommendations && summary.recommendations.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#166534', marginBottom: '0.5rem' }}>
                        Recommendations:
                      </h4>
                      <ul style={{ fontSize: '0.875rem', color: '#6b7280', paddingLeft: '1.25rem' }}>
                        {summary.recommendations.map((rec, idx) => (
                          <li key={idx} style={{ marginBottom: '0.25rem' }}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
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


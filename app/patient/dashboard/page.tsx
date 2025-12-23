'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query, Timestamp, where, limit, doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isPatient, getUserProfile } from '@/lib/auth-utils';

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

interface Consultation {
  id: string;
  roomName: string;
  patientName?: string;
  duration?: number;
  status?: string;
  joinedAt?: any;
  leftAt?: any;
  createdBy?: string;
  patientUserId?: string;
  isRealConsultation?: boolean;
  metadata?: {
    createdBy?: string;
    patientUserId?: string;
    doctorUserId?: string;
    visibleToUsers?: string[];
  };
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
          } else {
            // Patient is authenticated - link any consultations that match their email
            try {
              await fetch('/api/link-patient-consultations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: user.uid,
                  userEmail: user.email
                }),
              });
              console.log('Linked patient consultations');
            } catch (error) {
              console.error('Error linking consultations:', error);
            }
          }
        } else {
          // Not logged in, show message (patients can still use invitation links)
          setIsAuthorized(false);
        }
      });
      return unsubscribe;
    }
  }, [router]);

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

  useEffect(() => {
    if (!user || !db || !isAuthorized) {
      setLoading(false);
      return;
    }

    // NOTE: Patients should NOT see AI summaries - only doctors see those
    // We only fetch consultations (session history), not call-summaries

    // Fetch consultations to show ALL sessions (even without summaries)
    const consultationsRef = collection(db, 'consultations');
    const consultationsQuery1 = query(
      consultationsRef,
      where('metadata.visibleToUsers', 'array-contains', user.uid),
      limit(100)
    );

    const consultationsQuery2 = query(
      consultationsRef,
      where('patientUserId', '==', user.uid),
      limit(100)
    );

    let allConsultationSummaries: CallSummary[] = [];

    // NOTE: We don't process call-summaries for patients - only doctors see AI summaries

    // Process consultations
    const processConsultations = async (consultationData: Consultation[]) => {
      // Filter to show ALL real consultations (even 1-second sessions)
      // Show if patient joined (joinedAt exists) - this ensures even brief sessions are included
      const filtered = consultationData.filter(consultation => {
        const isReal = consultation.isRealConsultation === true;
        const hasJoined = consultation.joinedAt; // Patient joined the session
        const isVisible = consultation.metadata?.visibleToUsers?.includes(user.uid) || 
                         consultation.patientUserId === user.uid;
        // Show all real consultations where patient joined, regardless of duration
        return isReal && hasJoined && isVisible;
      });

      // Convert consultations to simple consultation format (NO summaries - only basic info)
      const consultationSummaries = await Promise.all(
        filtered.map(async (consultation) => {
          const doctorUserId = consultation.createdBy || consultation.metadata?.createdBy || consultation.metadata?.doctorUserId;
          const patientUserId = consultation.patientUserId || consultation.metadata?.patientUserId || user.uid;
          
          const doctorEmail = await fetchUserEmail(doctorUserId);
          const patientEmail = await fetchUserEmail(patientUserId);

          const joinedAt = consultation.joinedAt?.toDate?.() || consultation.joinedAt;
          const leftAt = consultation.leftAt?.toDate?.() || consultation.leftAt;
          const createdAt = leftAt || joinedAt || new Date();

          // Calculate duration in minutes
          let durationMinutes = consultation.duration || 0;
          if (joinedAt && leftAt && !durationMinutes) {
            durationMinutes = Math.round((leftAt.getTime() - joinedAt.getTime()) / (1000 * 60));
          }

          return {
            id: consultation.id,
            roomName: consultation.roomName,
            // No summary text - patients don't see AI summaries
            summary: undefined,
            keyPoints: undefined,
            recommendations: undefined,
            followUpActions: undefined,
            riskLevel: undefined,
            category: undefined,
            participants: [consultation.patientName || 'Unknown Patient'],
            duration: durationMinutes,
            createdAt: createdAt,
            createdBy: doctorUserId,
            patientUserId: patientUserId,
            doctorEmail: doctorEmail || undefined,
            patientEmail: patientEmail || undefined,
            metadata: {
              totalParticipants: 1,
              createdBy: doctorUserId,
              patientUserId: patientUserId,
              source: 'consultation_tracking',
              hasTranscriptionData: false,
              consultationData: true
            }
          } as CallSummary;
        })
      );

      allConsultationSummaries = consultationSummaries;
      updateDisplay();
    };

    const updateDisplay = () => {
      // Only show consultations (no AI summaries for patients)
      const unique = allConsultationSummaries.filter((item, index, self) => 
        index === self.findIndex(t => t.roomName === item.roomName)
      );

      // Sort by date
      const sorted = unique.sort((a, b) => {
        const aTime = (a.createdAt instanceof Date ? a.createdAt.getTime() : 
                      (a.createdAt && typeof a.createdAt === 'object' && 'toDate' in a.createdAt ? 
                       (a.createdAt as any).toDate().getTime() : 0)) || 0;
        const bTime = (b.createdAt instanceof Date ? b.createdAt.getTime() : 
                      (b.createdAt && typeof b.createdAt === 'object' && 'toDate' in b.createdAt ? 
                       (b.createdAt as any).toDate().getTime() : 0)) || 0;
        return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
      });

      setSummaries(sorted);
      setLoading(false);
    };

    // NOTE: No listeners for call-summaries - patients don't see AI summaries

    // Listen to consultations
    const unsubscribe3 = onSnapshot(consultationsQuery1, async (snapshot) => {
      const consultationData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Consultation[];
      await processConsultations(consultationData);
    }, (error) => {
      console.error('Error fetching consultations:', error);
    });

    const unsubscribe4 = onSnapshot(consultationsQuery2, async (snapshot) => {
      const consultationData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Consultation[];
      await processConsultations(consultationData);
    }, (error) => {
      console.error('Error fetching consultations by patientUserId:', error);
    });

    return () => {
      unsubscribe3();
      unsubscribe4();
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
                    {summary.duration > 0 && (
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: '#dcfce7',
                        color: '#166534',
                        marginLeft: '1rem'
                      }}>
                        {summary.duration} min
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                    {summary.duration > 0 ? (
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


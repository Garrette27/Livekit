'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query, Timestamp, where, limit, getFirestore, doc, setDoc } from 'firebase/firestore';
import Link from 'next/link';

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
  };
  createdBy?: string; // Added for client-side filtering
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
    visibleToUsers?: string[];
  };
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [summaries, setSummaries] = useState<CallSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Handle authentication
  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log('Dashboard: Auth state changed:', user ? 'User logged in' : 'No user');
        setUser(user);
      });
      return unsubscribe;
    }
  }, []);

  // Fetch summaries from Firestore (reacts to sortOrder)
  useEffect(() => {
    if (!user || !db) return;

    console.log('Dashboard: Setting up Firestore listener for call-summaries');
    console.log('Dashboard: Current user ID:', user.uid);
    console.log('Dashboard: Sort order:', sortOrder);
    
    const summariesRef = collection(db, 'call-summaries');
    
    // Use a simpler query that doesn't require a composite index
    // We'll filter by user on the client side for now
    const q = query(
      summariesRef,
      orderBy('createdAt', sortOrder),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allSummaries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CallSummary[];
      
        // Filter by user on the client side - show summaries for current user and exclude test data
  const userSummaries = allSummaries.filter(summary => {
    const summaryUserId = summary.createdBy || summary.metadata?.createdBy;
    const isUserSummary = summaryUserId === user.uid;
    
    // Only show summaries that belong to the current user
    // Remove legacy summary logic that was showing summaries from other users
    const isLegacySummary = false; // Disabled to prevent showing other users' summaries
    
    // Exclude test data - be more comprehensive in detecting test data
    // But allow test-consultation summaries to be shown for testing purposes
    const isTestData = (summary.metadata as any)?.testData || 
                      (summary as any).testData || 
                      (summary.metadata as any)?.source === 'test' ||
                      (summary.metadata as any)?.test === true ||
                      summary.roomName?.includes('test-room-') ||
                      summary.roomName?.includes('test-transcription-') ||
                      summary.roomName?.includes('test_');
    
    // Allow test-consultation summaries to be shown (they have source: 'test_consultation')
    const isTestConsultation = (summary.metadata as any)?.source === 'test_consultation';
    
    if (isUserSummary && !isTestData) {
      console.log('Dashboard: Found user summary:', summary.roomName, 'User ID:', summaryUserId);
    } else if (isTestConsultation && isUserSummary) {
      console.log('Dashboard: Found test consultation summary:', summary.roomName, 'User ID:', summaryUserId);
    } else if (isTestData) {
      console.log('Dashboard: Excluding test data:', summary.roomName);
    } else {
      console.log('Dashboard: Excluding summary for different user:', summary.roomName, 'Summary User ID:', summaryUserId, 'Current User ID:', user.uid);
    }
    
    return (isUserSummary || isLegacySummary) && (!isTestData || isTestConsultation); // Show user summaries, legacy summaries, and test consultations
  });


      
      console.log('Dashboard: Received summaries:', userSummaries.length, 'summaries for user', user.uid);
      console.log('Dashboard: Total summaries in database:', allSummaries.length);
      console.log('Dashboard: User ID:', user.uid);
      console.log('Dashboard: All summaries user IDs:', allSummaries.map(s => ({ room: s.roomName, userId: s.createdBy || s.metadata?.createdBy })));
      // Firestore already orders by createdAt, but keep a defensive client-side reorder
      const ordered = [...userSummaries].sort((a, b) => {
        const ad = a.createdAt?.toDate?.() ? a.createdAt.toDate().getTime() : 0;
        const bd = b.createdAt?.toDate?.() ? b.createdAt.toDate().getTime() : 0;
        return sortOrder === 'desc' ? bd - ad : ad - bd;
      });
      setSummaries(ordered);
      setLoading(false);
    }, (error) => {
      console.error('Dashboard: Error fetching summaries:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, sortOrder]);

  // Also fetch real consultations from the consultations collection and merge with summaries
  useEffect(() => {
    if (!user || !db) return;

    const consultationsRef = collection(db, 'consultations');
    // Remove the composite query that requires an index - just get all consultations and filter client-side
    const q = query(
      consultationsRef,
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const realConsultations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Consultation[];
      
      console.log('Dashboard: Found real consultations:', realConsultations.length);
      console.log('Dashboard: All consultations:', realConsultations.map(c => ({ 
        roomName: c.roomName, 
        createdBy: c.createdBy, 
        status: c.status, 
        isRealConsultation: c.isRealConsultation 
      })));
      
      // Convert consultations to summary format and merge with existing summaries
      const consultationSummaries = realConsultations
        .filter(consultation => {
          const consultationUserId = consultation.createdBy || consultation.metadata?.createdBy;
          const patientUserId = consultation.patientUserId || consultation.metadata?.patientUserId;
          const visibleToUsers = consultation.metadata?.visibleToUsers || [];
          
          // Show consultations if:
          // 1. User is the doctor (createdBy matches)
          // 2. User is the patient (patientUserId matches)
          // 3. User is in the visibleToUsers array
          const isDoctorConsultation = consultationUserId === user.uid;
          const isPatientConsultation = patientUserId === user.uid;
          const isVisibleToUser = visibleToUsers.includes(user.uid);
          const isRealConsultation = consultation.isRealConsultation === true;
          const isCompleted = consultation.status === 'completed';
          
          const shouldShow = (isDoctorConsultation || isPatientConsultation || isVisibleToUser) && isRealConsultation && isCompleted;
          
          // Debug logging for consultation filtering
          if (!shouldShow) {
            console.log('Dashboard: Consultation filtered out:', {
              roomName: consultation.roomName,
              consultationUserId,
              patientUserId,
              visibleToUsers,
              currentUserId: user.uid,
              isDoctorConsultation,
              isPatientConsultation,
              isVisibleToUser,
              isRealConsultation,
              isCompleted,
              shouldShow
            });
          }
          
          return shouldShow;
        })
        .map(consultation => ({
          id: consultation.id,
          roomName: consultation.roomName,
          summary: `Consultation completed with ${consultation.patientName || 'Unknown Patient'}. Duration: ${consultation.duration || 0} minutes.`,
          keyPoints: [
            `Patient: ${consultation.patientName || 'Unknown Patient'}`,
            `Duration: ${consultation.duration || 0} minutes`,
            `Status: ${consultation.status}`,
            'No AI analysis available'
          ],
          recommendations: ['Follow up as needed', 'Review consultation notes if available'],
          followUpActions: ['Schedule follow-up if required', 'Document consultation outcomes'],
          riskLevel: 'Low',
          category: 'General Consultation',
          participants: [consultation.patientName || 'Unknown Patient'],
          duration: consultation.duration || 0,
          createdAt: consultation.leftAt || consultation.joinedAt || new Date(),
          createdBy: consultation.createdBy || consultation.metadata?.createdBy,
          metadata: {
            totalParticipants: 1,
            createdBy: consultation.createdBy || consultation.metadata?.createdBy,
            source: 'consultation_tracking',
            hasTranscriptionData: false,
            consultationData: true
          }
        }));

      console.log('Dashboard: Generated consultation summaries:', consultationSummaries.length);
      console.log('Dashboard: Consultation summaries:', consultationSummaries.map(s => ({ 
        roomName: s.roomName, 
        createdBy: s.createdBy, 
        duration: s.duration 
      })));

      // Merge with existing summaries and remove duplicates
      setSummaries(prevSummaries => {
        const allSummaries = [...prevSummaries, ...consultationSummaries];
        const uniqueSummaries = allSummaries.filter((summary, index, self) => 
          index === self.findIndex(s => s.roomName === summary.roomName)
        );
        
        // Sort by creation date
        return uniqueSummaries.sort((a, b) => {
          const ad = a.createdAt?.toDate?.() ? a.createdAt.toDate().getTime() : 0;
          const bd = b.createdAt?.toDate?.() ? b.createdAt.toDate().getTime() : 0;
          return sortOrder === 'desc' ? bd - ad : ad - bd;
        });
      });
    }, (error) => {
      console.error('Dashboard: Error fetching consultations:', error);
    });

    return () => unsubscribe();
  }, [user, sortOrder]);


  const handleSignOut = () => {
    if (auth) {
      auth.signOut();
    }
    window.location.href = '/';
  };

  if (!user) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#eff6ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '1.5rem',
          padding: '2rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '28rem',
          width: '100%',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af', marginBottom: '1rem' }}>
            Access Denied
          </h1>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            Please sign in to access the dashboard.
          </p>
          <Link 
            href="/" 
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
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#eff6ff',
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e40af' }}>
            Loading Dashboard...
          </h2>
          <p style={{ color: '#2563eb', marginTop: '0.5rem' }}>
            Fetching your consultation history
          </p>
        </div>
      </div>
    );
  }

  // Filter out test data for statistics - use same logic as main filtering
  const realSummaries = summaries.filter(summary => {
    const isTestData = (summary.metadata as any)?.testData || 
                      (summary as any).testData || 
                      (summary.metadata as any)?.source === 'test' ||
                      (summary.metadata as any)?.test === true ||
                      summary.roomName?.includes('test-room-') ||
                      summary.roomName?.includes('test-transcription-') ||
                      summary.roomName?.includes('test_');
    const isTestConsultation = (summary.metadata as any)?.source === 'test_consultation';
    return !isTestData || isTestConsultation; // Include test consultations in statistics
  });

  const totalCalls = realSummaries.length;
  const thisMonth = realSummaries.filter(s => {
    const now = new Date();
    const summaryDate = s.createdAt?.toDate?.() ? s.createdAt.toDate() : (s.createdAt instanceof Date ? s.createdAt : new Date());
    return summaryDate.getMonth() === now.getMonth() && 
           summaryDate.getFullYear() === now.getFullYear();
  }).length;
  const avgDuration = realSummaries.length > 0 
    ? Math.round(realSummaries.reduce((acc, s) => acc + (s.duration || 0), 0) / realSummaries.length)
    : 0;

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#eff6ff',
      padding: '2rem'
    }}>
      <div style={{ 
        maxWidth: '72rem', 
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '1.875rem', 
            fontWeight: 'bold', 
            color: '#1e40af', 
            marginBottom: '0.5rem' 
          }}>
            Telehealth Console
          </h1>
          <p style={{ 
            color: '#1d4ed8', 
            marginBottom: '1rem' 
          }}>
            Welcome, {user.displayName || user.email}
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            {/* Sort control */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              backgroundColor: 'white', border: '1px solid #e5e7eb',
              padding: '0.5rem 0.75rem', borderRadius: '0.5rem'
            }}>
              <span style={{ color: '#1e40af', fontWeight: 600 }}>Sort:</span>
              <button
                onClick={() => setSortOrder('desc')}
                style={{
                  backgroundColor: sortOrder === 'desc' ? '#2563eb' : '#e5e7eb',
                  color: sortOrder === 'desc' ? 'white' : '#1e293b',
                  padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
                  border: 'none', fontWeight: 600, cursor: 'pointer'
                }}
                title="Newest first"
              >Newest</button>
              <button
                onClick={() => setSortOrder('asc')}
                style={{
                  backgroundColor: sortOrder === 'asc' ? '#2563eb' : '#e5e7eb',
                  color: sortOrder === 'asc' ? 'white' : '#1e293b',
                  padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
                  border: 'none', fontWeight: 600, cursor: 'pointer'
                }}
                title="Oldest first"
              >Oldest</button>
            </div>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                backgroundColor: '#2563eb',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              New Call
            </button>
            <button
              onClick={() => {
                const roomName = prompt('Enter room name to create:');
                if (roomName && roomName.trim()) {
                  // Create the room in Firestore first
                  if (db && user) {
                    console.log('Creating room with user:', user.uid);
                    console.log('Firebase ready:', !!db);
                    console.log('User authenticated:', !!user);
                    
                    const roomRef = doc(db, 'rooms', roomName.trim());
                    setDoc(roomRef, {
                      roomName: roomName.trim(),
                      createdBy: user.uid,
                      createdAt: new Date(),
                      status: 'active',
                      metadata: {
                        createdBy: user.uid,
                        userId: user.uid,
                        userEmail: user.email,
                        userName: user.displayName
                      }
                    }).then(() => {
                      console.log('Room created successfully:', roomName.trim());
                      // Navigate to the room creation page (not the room itself)
                      window.location.href = `/create-room/${roomName.trim()}`;
                    }).catch((error: any) => {
                      console.error('Error creating room:', error);
                      console.error('Error code:', error.code);
                      console.error('Error message:', error.message);
                      alert(`Error creating room: ${error.message}. Please check console for details.`);
                    });
                  } else {
                    console.log('Firestore or user not available, using fallback');
                    // Fallback if Firestore not available
                    window.location.href = `/create-room/${roomName.trim()}`;
                  }
                }
              }}
              style={{
                backgroundColor: '#059669',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Create Room
            </button>
            <button
              onClick={handleSignOut}
              style={{
                backgroundColor: 'transparent',
                color: '#dc2626',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #dc2626',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem', 
          marginBottom: '2rem' 
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1rem',
            textAlign: 'center',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
          }}>
            <p style={{ fontSize: '0.875rem', color: '#2563eb' }}>Total Consultations</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af' }}>{totalCalls}</p>
          </div>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1rem',
            textAlign: 'center',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
          }}>
            <p style={{ fontSize: '0.875rem', color: '#2563eb' }}>This Month</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af' }}>{thisMonth}</p>
          </div>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1rem',
            textAlign: 'center',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
          }}>
            <p style={{ fontSize: '0.875rem', color: '#2563eb' }}>Avg Duration</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af' }}>{avgDuration} min</p>
          </div>
        </div>

        {/* AI Summaries */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '1.5rem 2rem',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              color: '#1e40af' 
            }}>
              Recent Consultation Summaries
            </h2>
            <p style={{ 
              color: '#1d4ed8', 
              marginTop: '0.5rem' 
            }}>
              AI-generated structured summaries of your completed consultations
            </p>
          </div>
          
          <div>
            {summaries.length === 0 ? (
              <div style={{
                padding: '4rem 2rem',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '5rem',
                  height: '5rem',
                  backgroundColor: '#dbeafe',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}>
                  <span style={{ fontSize: '2.5rem', color: '#2563eb' }}>📋</span>
                </div>
                <h3 style={{ 
                  fontSize: '1.125rem', 
                  fontWeight: '500', 
                  color: '#1e40af', 
                  marginBottom: '0.5rem' 
                }}>
                  No consultations yet
                </h3>
                <p style={{ 
                  color: '#1d4ed8', 
                  marginBottom: '1.5rem' 
                }}>
                  Start your first video consultation to see AI-generated summaries here.
                </p>
                <Link 
                  href="/" 
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
                  Start First Call
                </Link>
              </div>
            ) : (
              <div>
                {summaries.map((summary) => (
                  <div key={summary.id} style={{
                    padding: '1.5rem 2rem',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    <div style={{ marginBottom: '1rem' }}>
                      <h3 style={{ 
                        fontSize: '1.25rem', 
                        fontWeight: '600', 
                        color: '#1e40af',
                        marginBottom: '0.5rem'
                      }}>
                        Room: {summary.roomName}
                      </h3>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{
                          backgroundColor: '#dbeafe',
                          color: '#1e40af',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.875rem',
                          fontWeight: '500'
                        }}>
                          {summary.duration || 0} min
                        </span>
                        <span style={{
                          backgroundColor: '#fef3c7',
                          color: '#92400e',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.875rem',
                          fontWeight: '500'
                        }}>
                          {summary.riskLevel} Risk
                        </span>
                        <span style={{
                          backgroundColor: '#dbeafe',
                          color: '#1e40af',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.875rem',
                          fontWeight: '500'
                        }}>
                          {summary.category}
                        </span>
                      </div>
                    </div>
                    
                    <div style={{
                      backgroundColor: '#eff6ff',
                      borderRadius: '0.75rem',
                      padding: '1rem',
                      borderLeft: '4px solid #2563eb',
                      marginBottom: '1rem'
                    }}>
                      <h4 style={{ 
                        fontWeight: '600', 
                        color: '#1e40af', 
                        marginBottom: '0.5rem' 
                      }}>
                        Summary
                      </h4>
                      <p style={{ 
                        color: '#1e40af', 
                        lineHeight: '1.6' 
                      }}>
                        {summary.summary}
                      </p>
                    </div>
                    
                    {/* Summary metadata */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '1rem', 
                      marginTop: '1rem',
                      fontSize: '0.875rem',
                      color: '#6b7280'
                    }}>
                      <span>📅 {summary.createdAt?.toDate?.() ? 
                        summary.createdAt.toDate().toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 
                        'Date not available'
                      }</span>
                      <span>👥 {summary.participants || summary.metadata?.totalParticipants || 0} participants</span>
                      <span>🔒 Auto-delete in 30 days</span>
                    </div>
                  </div>
                ))}
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

'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query, Timestamp, where, limit, getFirestore, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
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
    isEdited?: boolean;
    lastEditedAt?: Timestamp;
    lastEditedBy?: string;
    editHistory?: Array<{
      editedAt: Date;
      editedBy: string;
      changes: string[];
    }>;
  };
  createdBy?: string; // Added for client-side filtering
  _logged?: boolean; // Internal flag for one-time logging during render
  doctorEmail?: string;
  patientEmail?: string;
  patientUserId?: string;
  lastEditedAt?: Timestamp;
  lastEditedBy?: string;
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
  const [editingSummary, setEditingSummary] = useState<CallSummary | null>(null);
  const [editForm, setEditForm] = useState({
    summary: '',
    keyPoints: [] as string[],
    recommendations: [] as string[],
    followUpActions: [] as string[],
    riskLevel: '',
    category: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    
    // Filter by user to comply with security rules
    const q = query(
      summariesRef,
      where('createdBy', '==', user.uid),
      orderBy('createdAt', sortOrder),
      limit(100)
    );

    // Add debouncing to prevent excessive re-renders
    let timeoutId: NodeJS.Timeout;
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Clear previous timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Debounce the processing by 500ms
      timeoutId = setTimeout(async () => {
        const allSummaries = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CallSummary[];
        
        // Fetch emails for summaries - prefer stored email, fallback to user document lookup
        const summariesWithEmails = await Promise.all(
          allSummaries.map(async (summary) => {
            // Try to get patient email from summary first (stored directly)
            let patientEmail = (summary as any).patientEmail || (summary.metadata as any)?.patientEmail;
            if (!patientEmail) {
              // Fallback to fetching from user document
              patientEmail = await fetchUserEmail(summary.patientUserId || (summary.metadata as any)?.patientUserId);
            }
            
            // Try to get doctor email from summary first
            let doctorEmail = (summary as any).doctorEmail || (summary.metadata as any)?.doctorEmail;
            if (!doctorEmail) {
              // Fallback to fetching from user document
              doctorEmail = await fetchUserEmail(summary.createdBy || summary.metadata?.createdBy);
            }
            
            return {
              ...summary,
              doctorEmail: doctorEmail || undefined,
              patientEmail: patientEmail || undefined
            };
          })
        );
        
          // Filter by user on the client side - show summaries for current user and exclude test data
    const userSummaries = summariesWithEmails.filter(summary => {
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
      
      // Reduced logging to prevent console spam
      if (isUserSummary && !isTestData) {
        // Only log once per summary to reduce noise
        if (!summary._logged) {
          console.log('Dashboard: Found user summary:', summary.roomName, 'User ID:', summaryUserId);
          summary._logged = true;
        }
      } else if (isTestConsultation && isUserSummary) {
        if (!summary._logged) {
          console.log('Dashboard: Found test consultation summary:', summary.roomName, 'User ID:', summaryUserId);
          summary._logged = true;
        }
      } else if (isTestData) {
        // Skip logging test data exclusions to reduce noise
      } else {
        // Skip logging different user exclusions to reduce noise
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
      }, 500); // 500ms debounce
    }, (error) => {
      console.error('Dashboard: Error fetching summaries:', error);
      setLoading(false);
    });

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      unsubscribe();
    };
  }, [user, sortOrder]);

  const handleEdit = (summary: CallSummary) => {
    setEditingSummary(summary);
    setEditForm({
      summary: summary.summary || '',
      keyPoints: summary.keyPoints || [],
      recommendations: summary.recommendations || [],
      followUpActions: summary.followUpActions || [],
      riskLevel: summary.riskLevel || '',
      category: summary.category || ''
    });
    setSaveError(null);
  };

  const handleCancelEdit = () => {
    setEditingSummary(null);
    setEditForm({
      summary: '',
      keyPoints: [],
      recommendations: [],
      followUpActions: [],
      riskLevel: '',
      category: ''
    });
    setSaveError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingSummary || !user) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      // Get Firebase ID token for authentication
      const token = await user.getIdToken();

      const response = await fetch('/api/summary/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          summaryId: editingSummary.id,
          summary: editForm.summary,
          keyPoints: editForm.keyPoints,
          recommendations: editForm.recommendations,
          followUpActions: editForm.followUpActions,
          riskLevel: editForm.riskLevel,
          category: editForm.category
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update summary');
      }

      // Close edit modal - the real-time listener will update the UI
      handleCancelEdit();
    } catch (error) {
      console.error('Error saving summary:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const updateKeyPoint = (index: number, value: string) => {
    const newKeyPoints = [...editForm.keyPoints];
    newKeyPoints[index] = value;
    setEditForm({ ...editForm, keyPoints: newKeyPoints });
  };

  const addKeyPoint = () => {
    setEditForm({ ...editForm, keyPoints: [...editForm.keyPoints, ''] });
  };

  const removeKeyPoint = (index: number) => {
    const newKeyPoints = editForm.keyPoints.filter((_, i) => i !== index);
    setEditForm({ ...editForm, keyPoints: newKeyPoints });
  };

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

  // Also fetch real consultations from the consultations collection and merge with summaries
  useEffect(() => {
    if (!user || !db) return;

    const consultationsRef = collection(db, 'consultations');

    // Query A: consultations created by the current user (doctor view)
    const byCreator = query(
      consultationsRef,
      where('createdBy', '==', user.uid),
      limit(100)
    );

    // Query B: consultations visible to the current user (patient view)
    const visibleToUser = query(
      consultationsRef,
      where('metadata.visibleToUsers', 'array-contains', user.uid),
      limit(100)
    );

    // Debounce timers for both listeners
    let timeoutA: NodeJS.Timeout | undefined;
    let timeoutB: NodeJS.Timeout | undefined;

    // Helper to process a snapshot into summaries and merge
    const processAndMerge = async (consultations: Consultation[]) => {
      console.log('Dashboard: Found real consultations:', consultations.length);

      const filtered = consultations.filter(consultation => {
        const consultationUserId = consultation.createdBy || consultation.metadata?.createdBy;
        const patientUserId = consultation.patientUserId || consultation.metadata?.patientUserId;
        const visibleToUsers = consultation.metadata?.visibleToUsers || [];

        const isDoctorConsultation = consultationUserId === user.uid;
        const isPatientConsultation = patientUserId === user.uid;
        const isVisibleToUser = visibleToUsers.includes(user.uid);
        const isRealConsultation = consultation.isRealConsultation === true;
        const isCompleted = consultation.status === 'completed';

        return (isDoctorConsultation || isPatientConsultation || isVisibleToUser) && isRealConsultation && isCompleted;
      });

      // Fetch emails for all consultations - prefer stored email, fallback to user document lookup
      const consultationSummaries = await Promise.all(
        filtered.map(async (consultation) => {
          const doctorUserId = consultation.createdBy || consultation.metadata?.createdBy;
          const patientUserId = consultation.patientUserId || consultation.metadata?.patientUserId;
          
          // Try to get patient email from consultation first (stored directly)
          let patientEmail = (consultation as any).patientEmail || (consultation.metadata as any)?.patientEmail;
          if (!patientEmail) {
            // Fallback to fetching from user document
            patientEmail = await fetchUserEmail(patientUserId);
          }
          
          // Try to get doctor email from consultation first
          let doctorEmail = (consultation as any).doctorEmail || (consultation.metadata as any)?.doctorEmail;
          if (!doctorEmail) {
            // Fallback to fetching from user document
            doctorEmail = await fetchUserEmail(doctorUserId);
          }

          return {
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
            createdBy: doctorUserId,
            patientUserId: patientUserId,
            doctorEmail: doctorEmail || undefined,
            patientEmail: patientEmail || undefined,
            metadata: {
              totalParticipants: 1,
              createdBy: doctorUserId,
              source: 'consultation_tracking',
              hasTranscriptionData: false,
              consultationData: true
            }
          };
        })
      );

      console.log('Dashboard: Generated consultation summaries:', consultationSummaries.length);

      setSummaries(prevSummaries => {
        const allSummaries = [...prevSummaries, ...consultationSummaries];
        const uniqueSummaries = allSummaries.filter((summary, index, self) =>
          index === self.findIndex(s => s.roomName === summary.roomName)
        );

        return uniqueSummaries.sort((a, b) => {
          const ad = a.createdAt?.toDate?.() ? a.createdAt.toDate().getTime() : 0;
          const bd = b.createdAt?.toDate?.() ? b.createdAt.toDate().getTime() : 0;
          return sortOrder === 'desc' ? bd - ad : ad - bd;
        });
      });
    };

    const unsubA = onSnapshot(byCreator, async (snapshot) => {
      if (timeoutA) clearTimeout(timeoutA);
      timeoutA = setTimeout(async () => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Consultation[];
        await processAndMerge(docs);
      }, 500);
    }, (error) => console.error('Dashboard: Error fetching consultations by creator:', error));

    const unsubB = onSnapshot(visibleToUser, async (snapshot) => {
      if (timeoutB) clearTimeout(timeoutB);
      timeoutB = setTimeout(async () => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Consultation[];
        await processAndMerge(docs);
      }, 500);
    }, (error) => console.error('Dashboard: Error fetching consultations visible to user:', error));

    return () => {
      if (timeoutA) clearTimeout(timeoutA);
      if (timeoutB) clearTimeout(timeoutB);
      unsubA();
      unsubB();
    };
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
              onClick={() => window.location.href = '/doctor/invitations'}
              style={{
                backgroundColor: '#7C3AED',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Manage Invitations
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
                    <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ 
                          fontSize: '1.25rem', 
                          fontWeight: '600', 
                          color: '#1e40af',
                          marginBottom: '0.5rem'
                        }}>
                          Room: {summary.roomName}
                          {summary.metadata?.isEdited && (
                            <span style={{
                              marginLeft: '0.5rem',
                              fontSize: '0.75rem',
                              color: '#059669',
                              fontWeight: 'normal'
                            }}>
                              (Edited)
                            </span>
                          )}
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
                      <button
                        onClick={() => handleEdit(summary)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#2563eb',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Edit
                      </button>
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
                    {(summary.doctorEmail || summary.patientEmail) && (
                      <div style={{ 
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        color: '#374151'
                      }}>
                        {summary.doctorEmail && (
                          <div style={{ marginBottom: '0.25rem' }}>
                            👨‍⚕️ Doctor: <strong>{summary.doctorEmail}</strong>
                          </div>
                        )}
                        {summary.patientEmail && (
                          <div>
                            👤 Patient: <strong>{summary.patientEmail}</strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Edit Modal */}
      {editingSummary && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}
        onClick={handleCancelEdit}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              padding: '2rem',
              maxWidth: '48rem',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>
                Edit Summary: {editingSummary.roomName}
              </h2>
              <button
                onClick={handleCancelEdit}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0.25rem'
                }}
              >
                ×
              </button>
            </div>

            {saveError && (
              <div style={{
                padding: '0.75rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.375rem',
                color: '#dc2626',
                marginBottom: '1rem'
              }}>
                {saveError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Summary
                </label>
                <textarea
                  value={editForm.summary}
                  onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Risk Level
                </label>
                <select
                  value={editForm.riskLevel}
                  onChange={(e) => setEditForm({ ...editForm, riskLevel: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Category
                </label>
                <input
                  type="text"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Key Points
                  </label>
                  <button
                    onClick={addKeyPoint}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#059669',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    + Add
                  </button>
                </div>
                {editForm.keyPoints.map((point, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      value={point}
                      onChange={(e) => updateKeyPoint(idx, e.target.value)}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    />
                    <button
                      onClick={() => removeKeyPoint(idx)}
                      style={{
                        padding: '0.5rem',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: isSaving ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

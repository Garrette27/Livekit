'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query, Timestamp, where, limit, getFirestore } from 'firebase/firestore';
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

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [summaries, setSummaries] = useState<CallSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  // Handle authentication
  useEffect(() => {
    if (auth) {
      return onAuthStateChanged(auth, (user) => {
        console.log('Dashboard: Auth state changed:', user ? 'User logged in' : 'No user');
        setUser(user);
      });
    }
  }, []);

  // Fetch summaries from Firestore
  useEffect(() => {
    if (!user) return;

    console.log('Dashboard: Setting up Firestore listener for call-summaries');
    console.log('Dashboard: Current user ID:', user.uid);
    
    const db = getFirestore();
    const summariesRef = collection(db, 'call-summaries');
    
    // Use a simpler query that doesn't require a composite index
    // We'll filter by user on the client side for now
    const q = query(
      summariesRef,
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allSummaries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CallSummary[];
      
      // Filter by user on the client side - only show summaries created by current user
      const userSummaries = allSummaries.filter(summary => {
        const summaryUserId = summary.createdBy || summary.metadata?.createdBy;
        const isUserSummary = summaryUserId === user.uid;
        
        if (isUserSummary) {
          console.log('Dashboard: Found user summary:', summary.roomName);
        }
        
        return isUserSummary; // Only show summaries created by current user
      });
      
      console.log('Dashboard: Received summaries:', userSummaries.length, 'summaries for user', user.uid);
      console.log('Dashboard: Total summaries in database:', allSummaries.length);
      setSummaries(userSummaries);
      setLoading(false);
    }, (error) => {
      console.error('Dashboard: Error fetching summaries:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleTestWebhook = async () => {
    try {
      setTestLoading(true);
      const response = await fetch('/api/test-livekit-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: 'test-room-' + Date.now() })
      });
      
      const result = await response.json();
      console.log('Test webhook result:', result);
      
      if (result.success) {
        alert('✅ Test completed successfully! Check the dashboard to see the generated summary.');
      } else {
        alert('❌ Test failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Test webhook error:', error);
      alert('❌ Test failed: ' + error);
    } finally {
      setTestLoading(false);
    }
  };

  const handleTestTranscription = async () => {
    try {
      setTestLoading(true);
      const roomName = 'test-transcription-' + Date.now();
      
      // First, add test transcription data
      const transcriptionResponse = await fetch('/api/test-transcription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomName,
          testData: [
            `[Doctor] (${new Date().toISOString()}): Hello, how are you feeling today?`,
            `[Patient] (${new Date().toISOString()}): I've been experiencing some issues with binary search trees and data structures.`,
            `[Doctor] (${new Date().toISOString()}): I understand. Let's discuss your symptoms and see how we can help with your algorithm problems.`,
            `[Patient] (${new Date().toISOString()}): Yes, I've been having trouble with time complexity and space complexity analysis.`,
            `[Doctor] (${new Date().toISOString()}): That's a common issue. Let me explain how we can optimize your approach.`,
            `[Manual Note] (${new Date().toISOString()}): Patient discussed binary search trees, time complexity, and algorithm optimization. Recommended further study of data structures.`
          ]
        })
      });
      
      const transcriptionResult = await transcriptionResponse.json();
      console.log('Test transcription result:', transcriptionResult);
      
      if (!transcriptionResult.success) {
        alert('❌ Transcription test failed: ' + (transcriptionResult.error || 'Unknown error'));
        return;
      }
      
      // Then trigger the webhook
      const webhookResponse = await fetch('/api/manual-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName })
      });
      
      const webhookResult = await webhookResponse.json();
      console.log('Test webhook result:', webhookResult);
      
      if (webhookResult.success) {
        alert('✅ Transcription test completed successfully! Check the dashboard to see the generated summary with actual conversation data.');
      } else {
        alert('❌ Webhook test failed: ' + (webhookResult.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Test transcription error:', error);
      alert('❌ Test failed: ' + error);
    } finally {
      setTestLoading(false);
    }
  };

  const handleSignOut = () => {
    auth?.signOut();
    window.location.href = '/';
  };

  const handleCleanupSummaries = async () => {
    if (!user) return;
    
    try {
      setCleanupLoading(true);
      const response = await fetch('/api/cleanup-summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      
      const result = await response.json();
      console.log('Cleanup result:', result);
      
      if (result.success) {
        alert(`✅ Cleanup completed!\n\nCleaned: ${result.cleanedCount} summaries\nDeleted: ${result.deletedCount} legacy summaries\nTotal processed: ${result.totalProcessed}`);
        // Refresh the page to show updated data
        window.location.reload();
      } else {
        alert('❌ Cleanup failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      alert('❌ Cleanup failed: ' + error);
    } finally {
      setCleanupLoading(false);
    }
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

  const totalCalls = summaries.length;
  const thisMonth = summaries.filter(s => {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return s.createdAt?.toDate?.() ? s.createdAt.toDate() > monthAgo : false;
  }).length;
  const avgDuration = summaries.length > 0 
    ? Math.round(summaries.reduce((acc, s) => acc + (s.duration || 0), 0) / summaries.length)
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
              onClick={handleTestWebhook}
              disabled={testLoading}
              style={{
                backgroundColor: '#059669',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontWeight: '600',
                cursor: testLoading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                opacity: testLoading ? 0.7 : 1
              }}
            >
              {testLoading ? 'Testing...' : 'Test Webhook'}
            </button>
            <button
              onClick={handleTestTranscription}
              disabled={testLoading}
              style={{
                backgroundColor: '#7c3aed',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontWeight: '600',
                cursor: testLoading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                opacity: testLoading ? 0.7 : 1
              }}
            >
              {testLoading ? 'Testing...' : 'Test Transcription'}
            </button>
            <button
              onClick={handleCleanupSummaries}
              disabled={cleanupLoading}
              style={{
                backgroundColor: '#f59e0b',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontWeight: '600',
                cursor: cleanupLoading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                opacity: cleanupLoading ? 0.7 : 1
              }}
            >
              {cleanupLoading ? 'Cleaning...' : 'Clean Data'}
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

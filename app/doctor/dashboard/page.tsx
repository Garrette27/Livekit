'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query, Timestamp, where, limit } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isDoctor } from '@/lib/auth-utils';

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
  createdBy?: string;
  lastEditedAt?: Timestamp;
  lastEditedBy?: string;
  _logged?: boolean;
}

export default function DoctorDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [summaries, setSummaries] = useState<CallSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isAuthorized, setIsAuthorized] = useState(false);
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
  const router = useRouter();

  // Handle authentication and role check - redirect to main dashboard
  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          const doctor = await isDoctor(user);
          if (doctor) {
            // Doctor is logged in - redirect to main dashboard
            router.replace('/dashboard');
            return;
          }
        }
        // Not a doctor or not logged in, redirect to login
        router.replace('/doctor/login');
      });
      return unsubscribe;
    }
  }, [router]);

  useEffect(() => {
    if (!user || !db || !isAuthorized) return;

    const summariesRef = collection(db, 'call-summaries');
    const q = query(
      summariesRef,
      where('createdBy', '==', user.uid),
      orderBy('createdAt', sortOrder),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const summaryData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CallSummary[];
      setSummaries(summaryData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching summaries:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, sortOrder, isAuthorized]);

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
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '1rem 2rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>
              Doctor Dashboard
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Welcome, {user?.displayName || user?.email}
            </p>
          </div>
          <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <Link href="/doctor/invitations" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '500' }}>
              Invitations
            </Link>
            <Link href="/" style={{ color: '#059669', textDecoration: 'none', fontWeight: '500' }}>
              Create Room
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
              Consultation History
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
                border: '2px solid #dbeafe',
                borderTop: '2px solid #2563eb',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }}></div>
              <p style={{ marginTop: '1rem', color: '#6b7280' }}>Loading consultations...</p>
            </div>
          ) : summaries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No consultations yet</p>
              <p>Your consultation summaries will appear here after video calls.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {summaries.map((summary) => (
                <div
                  key={summary.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    padding: '1.5rem',
                    backgroundColor: '#f9fafb'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', marginBottom: '0.5rem' }}>
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
                      <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {summary.createdAt?.toDate?.()?.toLocaleString() || 'Unknown date'}
                        {summary.metadata?.lastEditedAt && (
                          <span style={{ marginLeft: '0.5rem', fontStyle: 'italic' }}>
                            • Last edited: {summary.metadata.lastEditedAt?.toDate?.()?.toLocaleString() || 'Unknown'}
                          </span>
                        )}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: summary.riskLevel === 'High' ? '#fef2f2' : summary.riskLevel === 'Medium' ? '#fef3c7' : '#f0fdf4',
                        color: summary.riskLevel === 'High' ? '#dc2626' : summary.riskLevel === 'Medium' ? '#d97706' : '#059669'
                      }}>
                        {summary.riskLevel}
                      </span>
                      <button
                        onClick={() => handleEdit(summary)}
                        style={{
                          padding: '0.375rem 0.75rem',
                          backgroundColor: '#2563eb',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '500'
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                  <p style={{ color: '#374151', marginBottom: '1rem', lineHeight: '1.6' }}>
                    {summary.summary}
                  </p>
                  {summary.keyPoints && summary.keyPoints.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827', marginBottom: '0.5rem' }}>
                        Key Points:
                      </h4>
                      <ul style={{ fontSize: '0.875rem', color: '#6b7280', paddingLeft: '1.25rem' }}>
                        {summary.keyPoints.map((point, idx) => (
                          <li key={idx} style={{ marginBottom: '0.25rem' }}>{point}</li>
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


'use client';
import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/hooks/useAuthSession';
import { authenticatedFetch } from '@/lib/auth/authenticated-fetch';
import ConsultationHistoryView from './components/ConsultationHistoryView';
import type { ConsultationCardRecord } from './components/ConsultationCard';

export const dynamic = 'force-dynamic';

interface CallSummary {
  id: string;
  hasGeneratedSummary: boolean;
  roomName: string;
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  followUpActions: string[];
  riskLevel: string;
  category: string;
  createdAt: Timestamp;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  participants: string[];
  duration: number;
  waitingRoomHistory?: {
    totalParticipants: number;
    registeredParticipantCount: number;
    anonymousParticipantCount: number;
    participantEmails: string[];
    participants: Array<{
      waitingPatientId: string;
      invitationId: string | null;
      displayName: string;
      patientEmail: string | null;
      isAnonymous: boolean;
      status: 'waiting' | 'admitted' | 'left' | 'rejected';
      joinedAt: string | null;
      admittedAt: string | null;
      leftAt: string | null;
      removedAt: string | null;
      waitingDurationMinutes: number | null;
    }>;
  };
  chatHistory?: {
    totalMessages: number;
    firstMessageAt: string | null;
    lastMessageAt: string | null;
    participants: string[];
    messages: Array<{
      id: string;
      senderId: string;
      senderName: string;
      senderType: 'doctor' | 'patient' | 'system';
      text: string;
      createdAt: string | null;
    }>;
  };
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
  patientEmail?: string | null;
  lastEditedAt?: Timestamp;
  lastEditedBy?: string;
  _logged?: boolean;
}

interface DoctorHistoryResponseItem {
  id: string;
  roomName?: string;
  createdAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  duration?: number;
  doctorEmail?: string;
  patientEmail?: string;
  summary?: string;
  riskLevel?: string;
  category?: string;
  keyPoints?: string[];
  recommendations?: string[];
  followUpActions?: string[];
  waitingRoomHistory?: {
    totalParticipants: number;
    registeredParticipantCount: number;
    anonymousParticipantCount: number;
    participantEmails: string[];
    participants: Array<{
      waitingPatientId: string;
      invitationId: string | null;
      displayName: string;
      patientEmail: string | null;
      isAnonymous: boolean;
      status: 'waiting' | 'admitted' | 'left' | 'rejected';
      joinedAt: string | null;
      admittedAt: string | null;
      leftAt: string | null;
      removedAt: string | null;
      waitingDurationMinutes: number | null;
    }>;
  };
  chatHistory?: {
    totalMessages: number;
    firstMessageAt: string | null;
    lastMessageAt: string | null;
    participants: string[];
    messages: Array<{
      id: string;
      senderId: string;
      senderName: string;
      senderType: 'doctor' | 'patient' | 'system';
      text: string;
      createdAt: string | null;
    }>;
  };
}

function toTimestamp(value?: string | null): Timestamp {
  if (!value) {
    return Timestamp.fromDate(new Date(0));
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return Timestamp.fromDate(new Date(0));
  }

  return Timestamp.fromDate(parsedDate);
}

function mapHistoryRecordToSummary(record: DoctorHistoryResponseItem): CallSummary {
  const generatedSummary = typeof record.summary === 'string' ? record.summary.trim() : '';
  return {
    id: record.id,
    hasGeneratedSummary: generatedSummary.length > 0,
    roomName: record.roomName || 'Unknown Room',
    summary: generatedSummary || 'This completed consultation does not have a summary yet.',
    keyPoints: Array.isArray(record.keyPoints) ? record.keyPoints : [],
    recommendations: Array.isArray(record.recommendations) ? record.recommendations : [],
    followUpActions: Array.isArray(record.followUpActions) ? record.followUpActions : [],
    riskLevel: record.riskLevel || 'Pending',
    category: record.category || 'General',
    createdAt: toTimestamp(record.createdAt),
    startedAt: record.startedAt || record.createdAt ? toTimestamp(record.startedAt || record.createdAt || null) : undefined,
    endedAt: record.endedAt ? toTimestamp(record.endedAt) : undefined,
    participants: [],
    duration: Math.max(0, Math.round(Number(record.duration || 0))),
    waitingRoomHistory: record.waitingRoomHistory,
    chatHistory: record.chatHistory,
    patientEmail: record.patientEmail || null,
    metadata: {
      totalParticipants: 1,
    },
  };
}

function toDateOrNull(value?: Timestamp): Date | null {
  const dateValue = value?.toDate?.();
  return dateValue && dateValue.getTime() > 0 ? dateValue : null;
}

/** Adapts the dashboard's summary shape to what the history view renders. */
function toCardRecord(summary: CallSummary): ConsultationCardRecord {
  return {
    id: summary.id,
    roomName: summary.roomName,
    hasGeneratedSummary: summary.hasGeneratedSummary,
    summary: summary.summary,
    keyPoints: summary.keyPoints,
    recommendations: summary.recommendations,
    followUpActions: summary.followUpActions,
    riskLevel: summary.riskLevel,
    category: summary.category,
    patientEmail: summary.patientEmail,
    startedAt: toDateOrNull(summary.startedAt || summary.createdAt),
    endedAt: toDateOrNull(summary.endedAt),
    duration: summary.duration,
    isEdited: summary.metadata?.isEdited,
    waitingRoomHistory: summary.waitingRoomHistory,
    chatHistory: summary.chatHistory,
  };
}


export default function DoctorDashboard() {
  const { user, isAuthenticated, isAuthorized, isLoading: authLoading } = useAuthSession({
    requiredRole: 'doctor',
  });
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
  const [generatingSummaryId, setGeneratingSummaryId] = useState<string | null>(null);
  const [summaryActionError, setSummaryActionError] = useState<string | null>(null);
  const router = useRouter();

  // Handle authentication and role check
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated || !isAuthorized) {
      router.replace('/doctor/login');
    }
  }, [authLoading, isAuthenticated, isAuthorized, router]);

  const loadSummaries = useCallback(async () => {
    if (!user || !isAuthorized) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/doctor/history?includeChatHistory=true', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch doctor consultation history');
      }

      const records = Array.isArray(data.summaries) ? (data.summaries as DoctorHistoryResponseItem[]) : [];
      const mappedSummaries = records.map(mapHistoryRecordToSummary);
      mappedSummaries.sort((left, right) => {
        const leftMs = left.createdAt?.toDate?.().getTime() || 0;
        const rightMs = right.createdAt?.toDate?.().getTime() || 0;
        return sortOrder === 'desc' ? rightMs - leftMs : leftMs - rightMs;
      });
      setSummaries(mappedSummaries);
    } catch (error) {
      console.error('Error fetching summaries:', error);
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, sortOrder, user]);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

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

  const handleGenerateSummary = async (summary: CallSummary) => {
    setGeneratingSummaryId(summary.id);
    setSummaryActionError(null);
    try {
      const response = await authenticatedFetch('/api/summary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultationSessionId: summary.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate consultation summary');
      }
      await loadSummaries();
    } catch (error) {
      setSummaryActionError(
        error instanceof Error ? error.message : 'Failed to generate consultation summary'
      );
    } finally {
      setGeneratingSummaryId(null);
    }
  };

  // The history view works in its own record shape; these resolve a card back
  // to the summary the edit/generate flows operate on.
  const cardRecords = summaries.map(toCardRecord);

  const handleEditCard = (record: ConsultationCardRecord) => {
    const summary = summaries.find((candidate) => candidate.id === record.id);
    if (summary) {
      handleEdit(summary);
    }
  };

  const handleGenerateCard = (record: ConsultationCardRecord) => {
    const summary = summaries.find((candidate) => candidate.id === record.id);
    if (summary) {
      void handleGenerateSummary(summary);
    }
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

      await loadSummaries();
      // Close edit modal after refreshing history.
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
        padding: 'var(--header-padding)',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      }}>
        <div className="app-header-bar" style={{ maxWidth: '80rem', margin: '0 auto' }}>
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
      <main style={{ maxWidth: '80rem', margin: '0 auto', padding: 'var(--page-padding)' }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '2rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1.5rem' }}>
            Consultation History
          </h2>

          {summaryActionError && (
            <div
              role="alert"
              style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                border: '1px solid #fecaca',
                borderRadius: '0.5rem',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
              }}
            >
              {summaryActionError}
            </div>
          )}

          <ConsultationHistoryView
            records={cardRecords}
            loading={loading}
            sortOrder={sortOrder}
            onToggleSortOrder={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            generatingSummaryId={generatingSummaryId}
            onEdit={handleEditCard}
            onGenerate={handleGenerateCard}
          />
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
                X
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


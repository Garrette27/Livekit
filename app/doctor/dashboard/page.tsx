'use client';
import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/hooks/useAuthSession';
import { authenticatedFetch } from '@/lib/auth/authenticated-fetch';

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
    metadata: {
      totalParticipants: 1,
    },
  };
}

function formatTimestamp(value?: Timestamp): string {
  if (!value) {
    return 'Unknown';
  }

  const dateValue = value.toDate?.();
  if (!dateValue || dateValue.getTime() <= 0) {
    return 'Unknown';
  }

  return dateValue.toLocaleString();
}

function formatIsoTimestamp(value?: string | null): string {
  if (!value) {
    return 'N/A';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() <= 0) {
    return 'N/A';
  }

  return parsedDate.toLocaleString();
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
                        <strong>Started:</strong> {formatTimestamp(summary.startedAt || summary.createdAt)}
                        {' | '}
                        <strong>Ended:</strong> {formatTimestamp(summary.endedAt)}
                        {' | '}
                        <strong>Duration:</strong> {summary.duration} minute{summary.duration === 1 ? '' : 's'}
                        {summary.metadata?.lastEditedAt && (
                          <span style={{ marginLeft: '0.5rem', fontStyle: 'italic' }}>
                            | Last edited: {summary.metadata.lastEditedAt?.toDate?.()?.toLocaleString() || 'Unknown'}
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
                        backgroundColor: summary.riskLevel === 'High' ? '#fef2f2' : summary.riskLevel === 'Medium' ? '#fef3c7' : summary.riskLevel === 'Pending' ? '#f3f4f6' : '#f0fdf4',
                        color: summary.riskLevel === 'High' ? '#dc2626' : summary.riskLevel === 'Medium' ? '#d97706' : summary.riskLevel === 'Pending' ? '#4b5563' : '#059669'
                      }}>
                        {summary.riskLevel}
                      </span>
                      <button
                        onClick={() => summary.hasGeneratedSummary
                          ? handleEdit(summary)
                          : void handleGenerateSummary(summary)}
                        disabled={generatingSummaryId === summary.id}
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
                        {summary.hasGeneratedSummary
                          ? 'Edit'
                          : generatingSummaryId === summary.id
                            ? 'Generating...'
                            : 'Generate Summary'}
                      </button>
                    </div>
                  </div>
                  <p style={{
                    color: summary.hasGeneratedSummary ? '#374151' : '#6b7280',
                    marginBottom: '1rem',
                    lineHeight: '1.6',
                    fontStyle: summary.hasGeneratedSummary ? 'normal' : 'italic',
                  }}>
                    {summary.summary}
                  </p>
                  {summary.waitingRoomHistory && summary.waitingRoomHistory.totalParticipants > 0 && (
                    <div
                      style={{
                        marginBottom: '1rem',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #d1fae5',
                        backgroundColor: '#f0fdf4',
                      }}
                    >
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#065f46', marginBottom: '0.5rem' }}>
                        Waiting Room Timeline
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#065f46', marginBottom: '0.5rem' }}>
                        Registered: {summary.waitingRoomHistory.registeredParticipantCount}
                        {' | '}
                        Anonymous: {summary.waitingRoomHistory.anonymousParticipantCount}
                      </p>
                      {summary.waitingRoomHistory.participantEmails.length > 0 && (
                        <p style={{ fontSize: '0.75rem', color: '#047857', marginBottom: '0.5rem' }}>
                          Emails: {summary.waitingRoomHistory.participantEmails.join(', ')}
                        </p>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {summary.waitingRoomHistory.participants.map((participant) => (
                          <div
                            key={participant.waitingPatientId}
                            style={{
                              border: '1px solid #bbf7d0',
                              borderRadius: '0.375rem',
                              padding: '0.5rem',
                              backgroundColor: '#ffffff',
                            }}
                          >
                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#166534', marginBottom: '0.25rem' }}>
                              {participant.displayName} ({participant.patientEmail || 'anonymous'})
                            </p>
                            <p style={{ fontSize: '0.7rem', color: '#166534', marginBottom: '0.25rem' }}>
                              Joined: {formatIsoTimestamp(participant.joinedAt)}
                              {' | '}
                              Admitted: {formatIsoTimestamp(participant.admittedAt)}
                            </p>
                            <p style={{ fontSize: '0.7rem', color: '#166534', marginBottom: '0.25rem' }}>
                              Left: {formatIsoTimestamp(participant.leftAt)}
                              {' | '}
                              Removed: {formatIsoTimestamp(participant.removedAt)}
                            </p>
                            <p style={{ fontSize: '0.7rem', color: '#166534' }}>
                              Waiting duration: {participant.waitingDurationMinutes ?? 'N/A'} minute
                              {participant.waitingDurationMinutes === 1 ? '' : 's'}
                              {' | '}
                              Final status: {participant.status}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {summary.chatHistory && summary.chatHistory.totalMessages > 0 && (
                    <details
                      style={{
                        marginBottom: '1rem',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #dbeafe',
                        backgroundColor: '#eff6ff',
                      }}
                    >
                      <summary
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: '#1e3a8a',
                          cursor: generatingSummaryId === summary.id ? 'wait' : 'pointer',
                          opacity: generatingSummaryId === summary.id ? 0.7 : 1,
                        }}
                      >
                        Chat Transcript ({summary.chatHistory.totalMessages} message
                        {summary.chatHistory.totalMessages === 1 ? '' : 's'})
                      </summary>

                      <div style={{ marginTop: '0.75rem' }}>
                        <p style={{ fontSize: '0.75rem', color: '#1e40af', marginBottom: '0.5rem' }}>
                          First message: {formatIsoTimestamp(summary.chatHistory.firstMessageAt)}
                          {' | '}
                          Last message: {formatIsoTimestamp(summary.chatHistory.lastMessageAt)}
                        </p>
                        {summary.chatHistory.participants.length > 0 && (
                          <p style={{ fontSize: '0.75rem', color: '#1d4ed8', marginBottom: '0.5rem' }}>
                            Participants: {summary.chatHistory.participants.join(', ')}
                          </p>
                        )}
                        <div
                          style={{
                            maxHeight: '16rem',
                            overflowY: 'auto',
                            border: '1px solid #bfdbfe',
                            borderRadius: '0.375rem',
                            backgroundColor: '#ffffff',
                            padding: '0.5rem',
                          }}
                        >
                          {summary.chatHistory.messages.map((message) => (
                            <div
                              key={message.id}
                              style={{
                                borderBottom: '1px solid #e5e7eb',
                                padding: '0.375rem 0',
                              }}
                            >
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  color: '#1f2937',
                                }}
                              >
                                {message.senderName} ({message.senderType}) - {formatIsoTimestamp(message.createdAt)}
                              </p>
                              <p
                                style={{
                                  margin: '0.125rem 0 0 0',
                                  fontSize: '0.75rem',
                                  color: '#374151',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {message.text || '(empty message)'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>
                  )}
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


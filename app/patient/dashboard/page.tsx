'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { useAuthSession } from '@/hooks/useAuthSession';
import {
  getPendingConsultationSessionIds,
  removePendingConsultationSessionIds,
} from '@/lib/consultations/pending-session-client';
import { useToast } from '@/components/ui/feedback/ToastProvider';

// Joins an invite link by accepting either full URL or token.
function JoinWithInvitationLink() {
  const [invitationLink, setInvitationLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleJoin = () => {
    if (!invitationLink.trim()) {
      setError('Please enter an invitation link');
      return;
    }

    let token = invitationLink.trim();
    if (token.includes('/invite/')) {
      const parts = token.split('/invite/');
      if (parts.length > 1) {
        token = parts[1].split('?')[0];
      }
    }

    if (!token) {
      setError('Invalid invitation link format');
      return;
    }

    router.push(`/invite/${token}`);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <input
          type="text"
          value={invitationLink}
          onChange={(event) => {
            setInvitationLink(event.target.value);
            setError(null);
          }}
          placeholder="Paste invitation link here (e.g., https://.../invite/eyJhbGc...)"
          style={{
            flex: 1,
            padding: '0.75rem',
            border: error ? '1px solid #dc2626' : '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
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
            whiteSpace: 'nowrap',
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
        Tip: You can paste the full invitation link or only the token.
      </p>
    </div>
  );
}

export const dynamic = 'force-dynamic';

interface CallSummary {
  id: string;
  roomName: string;
  createdAt: Date | null;
  duration: number;
  doctorEmail?: string;
  patientEmail?: string;
}

interface PatientConsultationApiSummary {
  id: string;
  roomName?: string;
  createdAt?: string | null;
  duration?: number;
  doctorEmail?: string;
  patientEmail?: string;
}

interface PatientConsultationApiResponse {
  success: boolean;
  error?: string;
  summaries?: PatientConsultationApiSummary[];
}

function toSafeDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeSummary(summary: PatientConsultationApiSummary): CallSummary {
  return {
    id: summary.id,
    roomName: summary.roomName || 'Unknown Room',
    createdAt: toSafeDate(summary.createdAt),
    duration: Number.isFinite(Number(summary.duration)) ? Math.max(0, Math.round(Number(summary.duration))) : 0,
    doctorEmail: summary.doctorEmail,
    patientEmail: summary.patientEmail,
  };
}

function sortSummariesByDate(summaries: CallSummary[], order: 'desc' | 'asc'): CallSummary[] {
  return [...summaries].sort((left, right) => {
    const leftMillis = left.createdAt ? left.createdAt.getTime() : 0;
    const rightMillis = right.createdAt ? right.createdAt.getTime() : 0;
    return order === 'desc' ? rightMillis - leftMillis : leftMillis - rightMillis;
  });
}

export default function PatientDashboard() {
  const { showToast } = useToast();
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingSummaryId, setDeletingSummaryId] = useState<string | null>(null);
  const [pendingDeleteSummaryId, setPendingDeleteSummaryId] = useState<string | null>(null);
  const [deleteErrorSummaryId, setDeleteErrorSummaryId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (isAuthenticated && !isAuthorized) {
      router.replace('/');
    }
  }, [authLoading, isAuthenticated, isAuthorized, router]);

  useEffect(() => {
    if (!pendingDeleteSummaryId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPendingDeleteSummaryId(null);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [pendingDeleteSummaryId]);

  const loadSummaries = useCallback(async () => {
    if (!user || !isAuthorized) {
      setSummaries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/patient/consultations', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json()) as PatientConsultationApiResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to fetch consultation history');
      }

      const rawSummaries = Array.isArray(payload.summaries) ? payload.summaries : [];
      const normalizedSummaries = rawSummaries.map(normalizeSummary);
      setSummaries(sortSummariesByDate(normalizedSummaries, sortOrder));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch consultation history';
      setLoadError(message);
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, sortOrder, user]);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  const handleDelete = async (summary: CallSummary) => {
    if (!user) {
      return;
    }

    if (pendingDeleteSummaryId !== summary.id) {
      setPendingDeleteSummaryId(summary.id);
      showToast({
        kind: 'info',
        title: 'Confirm delete',
        message: `Click Delete again within 5 seconds to remove "${summary.roomName}".`,
      });
      return;
    }

    setPendingDeleteSummaryId(null);
    setDeletingSummaryId(summary.id);
    setDeleteError(null);
    setDeleteErrorSummaryId(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/summary/delete?id=${encodeURIComponent(summary.id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to delete consultation');
      }

      showToast({
        kind: 'success',
        title: 'Consultation deleted',
        message: `"${summary.roomName}" was removed from your history.`,
      });
      await loadSummaries();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete consultation';
      setDeleteError(message);
      setDeleteErrorSummaryId(summary.id);
      showToast({
        kind: 'error',
        title: 'Delete failed',
        message,
      });
    } finally {
      setDeletingSummaryId(null);
    }
  };

  const sortedSummaries = useMemo(() => sortSummariesByDate(summaries, sortOrder), [sortOrder, summaries]);

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '4rem',
              height: '4rem',
              border: '2px solid #dcfce7',
              borderTop: '2px solid #059669',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1.5rem',
            }}
          />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f0fdf4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '3rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            textAlign: 'center',
            maxWidth: '32rem',
          }}
        >
          <div
            style={{
              width: '5rem',
              height: '5rem',
              backgroundColor: '#dcfce7',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 2rem',
            }}
          >
            <span style={{ fontSize: '2rem' }}>P</span>
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
                textAlign: 'center',
              }}
            >
              Sign In to View History
            </Link>
            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              You can also join consultations using invitation links from your doctor.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '4rem',
              height: '4rem',
              border: '2px solid #dcfce7',
              borderTop: '2px solid #059669',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1.5rem',
            }}
          />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0fdf4' }}>
      <header
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #bbf7d0',
          padding: '1rem 2rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        }}
      >
        <div
          style={{
            maxWidth: '80rem',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#166534' }}>Patient Dashboard</h1>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Welcome, {user.displayName || user.email}</p>
          </div>
          <button
            onClick={() => auth && auth.signOut()}
            style={{
              backgroundColor: '#dc2626',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem' }}>
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '2rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            marginBottom: '2rem',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
            Join Consultation
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Enter the invitation link provided by your doctor to join a consultation.
          </p>
          <JoinWithInvitationLink />
        </div>

        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '2rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827' }}>My Consultation History</h2>
            <button
              onClick={() => setSortOrder((current) => (current === 'desc' ? 'asc' : 'desc'))}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Sort: {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div
                style={{
                  width: '3rem',
                  height: '3rem',
                  border: '2px solid #dcfce7',
                  borderTop: '2px solid #059669',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto',
                }}
              />
              <p style={{ marginTop: '1rem', color: '#6b7280' }}>Loading consultations...</p>
            </div>
          ) : loadError ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem',
                border: '1px solid #fecaca',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                borderRadius: '0.5rem',
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>Unable to load consultation history</p>
              <p style={{ marginTop: '0.5rem' }}>{loadError}</p>
              <button
                onClick={() => void loadSummaries()}
                style={{
                  marginTop: '1rem',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  padding: '0.5rem 0.9rem',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          ) : sortedSummaries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No consultations yet</p>
              <p>Your consultation history will appear here after your video calls.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {sortedSummaries.map((summary) => (
                <div
                  key={summary.id}
                  style={{
                    border: '1px solid #bbf7d0',
                    borderRadius: '0.5rem',
                    padding: '1.5rem',
                    backgroundColor: '#f0fdf4',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'start',
                      marginBottom: '1rem',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#166534', marginBottom: '0.5rem' }}>
                        Consultation: {summary.roomName}
                      </h3>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                        {summary.createdAt ? summary.createdAt.toLocaleString() : 'Unknown date'}
                      </p>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                        }}
                      >
                        {summary.doctorEmail && (
                          <span>
                            Doctor: <strong>{summary.doctorEmail}</strong>
                          </span>
                        )}
                        {summary.patientEmail && (
                          <span>
                            Patient: <strong>{summary.patientEmail}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                        }}
                      >
                        {summary.duration} min
                      </span>
                      <button
                        onClick={() => void handleDelete(summary)}
                        disabled={deletingSummaryId === summary.id}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor:
                            deletingSummaryId === summary.id
                              ? '#9ca3af'
                              : pendingDeleteSummaryId === summary.id
                              ? '#b91c1c'
                              : '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: deletingSummaryId === summary.id ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          whiteSpace: 'nowrap',
                          opacity: deletingSummaryId === summary.id ? 0.6 : 1,
                        }}
                      >
                        {deletingSummaryId === summary.id
                          ? 'Deleting...'
                          : pendingDeleteSummaryId === summary.id
                          ? 'Confirm Delete'
                          : 'Delete'}
                      </button>
                    </div>
                  </div>
                  {deleteError && deleteErrorSummaryId === summary.id && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        backgroundColor: '#fee2e2',
                        border: '1px solid #fca5a5',
                        borderRadius: '0.375rem',
                        color: '#991b1b',
                        fontSize: '0.875rem',
                      }}
                    >
                      Error: {deleteError}
                    </div>
                  )}
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                    <p>
                      Duration: {summary.duration} minute{summary.duration !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

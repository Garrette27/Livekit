'use client';
import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import Link from 'next/link';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useToast } from '@/components/ui/feedback/ToastProvider';
import { getDoctorHistoryRoute } from '@/lib/routes/doctor-routes';
import { authenticatedFetch } from '@/lib/auth/authenticated-fetch';
import { compactInvitationUrl } from '@/lib/invitations/invitation-link-display';

interface CreateRoomClientProps {
  room: string;
}

export default function CreateRoomClient({ room }: CreateRoomClientProps) {
  const { showToast } = useToast();
  const { user, isAuthorized, isLoading: authLoading } = useAuthSession({ requiredRole: 'doctor' });
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState<boolean>(false);

  useEffect(() => {
    // Check if Firebase is initialized
    if (auth) {
      setIsFirebaseReady(true);
    } else {
      console.warn('Firebase not initialized');
    }
  }, []);

  const createRoom = useCallback(async () => {
    if (!room.trim()) {
      setError('Invalid room name');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      const response = await authenticatedFetch('/api/invite/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: room,
          expiresInHours: 24,
          waitingRoomEnabled: true,
          maxPatients: 10,
          maxUses: 999999,
          doctorName: user?.displayName || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.inviteUrl) {
        throw new Error(result.error || 'Could not create a secure invitation');
      }
      setShareUrl(result.inviteUrl);

      try {
        await navigator.clipboard.writeText(result.inviteUrl);
        showToast({
          kind: 'success',
          title: 'Invitation created',
          message: 'Secure patient invitation copied to clipboard.',
        });
      } catch {
        showToast({
          kind: 'info',
          title: 'Invitation created',
          message: 'Use the Copy Link button to share the secure invitation.',
        });
      }
    } catch (error) {
      console.error('Error creating room:', error);
      setError(error instanceof Error ? error.message : 'Error creating secure invitation');
    } finally {
      setIsCreating(false);
    }
  }, [room, showToast, user?.displayName]);

  useEffect(() => {
    if (user && isAuthorized && room) {
      void createRoom();
    }
  }, [createRoom, isAuthorized, room, user]);

  // Loading state while Firebase initializes
  if (!isFirebaseReady || authLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>Creating Room...</h1>
          <p style={{ fontSize: '1.25rem', color: '#4B5563', marginBottom: '2rem' }}>Loading...</p>
          <div style={{ width: '2rem', height: '2rem', border: '3px solid #E5E7EB', borderTop: '3px solid #2563EB', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
        </div>
      </div>
    );
  }

  // Signed-out view
  if (!user || !isAuthorized) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>Telehealth Console</h1>
          <p style={{ fontSize: '1.25rem', color: '#4B5563', marginBottom: '2rem' }}>
            Please sign in with a provisioned doctor account to create a room
          </p>
          <button
            onClick={() => {
              // This will be handled by the main page login
              window.location.href = '/';
            }}
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
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'white', padding: '2rem' }}>
      <div style={{ maxWidth: '48rem', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
            Secure Invitation Created
          </h1>
          <p style={{ fontSize: '1.125rem', color: '#6B7280', marginBottom: '0.5rem' }}>
            Room: <strong>{room}</strong>
          </p>
          <p style={{ fontSize: '1rem', color: '#9CA3AF' }}>
            Share the signed invitation below with your patient
          </p>
        </div>

        {/* Share URL Section */}
        {shareUrl && (
          <div style={{
            backgroundColor: '#F9FAFB',
            border: '2px solid #E5E7EB',
            borderRadius: '0.75rem',
            padding: '2rem',
            marginBottom: '2rem',
            textAlign: 'center'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#374151', marginBottom: '1rem' }}>
              Patient Invitation
            </h2>
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #D1D5DB',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1rem',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color: '#374151'
            }}>
              {compactInvitationUrl(shareUrl)}
            </div>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  showToast({
                    kind: 'success',
                    title: 'Link copied',
                    message: 'Secure invitation copied to clipboard.',
                  });
                } catch {
                  showToast({
                    kind: 'error',
                    title: 'Copy failed',
                    message: 'Unable to copy link. Please copy it manually.',
                  });
                }
              }}
              style={{
                backgroundColor: '#10B981',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '1rem',
                marginRight: '1rem'
              }}
            >
              📋 Copy Link
            </button>
            <Link href={`/room/${room}/doctor`} style={{
              backgroundColor: '#2563EB',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '1rem',
              textDecoration: 'none',
              display: 'inline-block'
            }}>
              🎥 Join Room
            </Link>
          </div>
        )}

        {/* Loading State */}
        {isCreating && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ width: '3rem', height: '3rem', border: '4px solid #E5E7EB', borderTop: '4px solid #2563EB', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
            <p style={{ color: '#6B7280' }}>Creating room...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '2rem',
            color: '#DC2626'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Navigation */}
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link href={getDoctorHistoryRoute()} style={{
            backgroundColor: '#6B7280',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '1rem',
            textDecoration: 'none',
            display: 'inline-block',
            marginRight: '1rem'
          }}>
            📊 Back to Consultation History
          </Link>
          <Link href="/" style={{
            backgroundColor: '#374151',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '1rem',
            textDecoration: 'none',
            display: 'inline-block'
          }}>
            🏠 Back to Home
          </Link>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

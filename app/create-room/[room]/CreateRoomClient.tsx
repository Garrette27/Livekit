'use client';
import { useCallback, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useToast } from '@/components/ui/feedback/ToastProvider';

interface CreateRoomClientProps {
  room: string;
}

export default function CreateRoomClient({ room }: CreateRoomClientProps) {
  const { showToast } = useToast();
  const { user, isLoading: authLoading } = useAuthSession();
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState<boolean>(false);

  useEffect(() => {
    // Check if Firebase is initialized
    if (auth && db) {
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

    if (!db) {
      setError('Firebase not initialized. Please refresh the page.');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      
      // Store room creation with user ID
      const roomRef = doc(db, 'rooms', room);
      await setDoc(roomRef, {
        roomName: room,
        createdBy: user?.uid || 'anonymous',
        createdAt: new Date(),
        status: 'active',
        metadata: {
          createdBy: user?.uid || 'anonymous',
          userId: user?.uid || 'anonymous',
          userEmail: user?.email,
          userName: user?.displayName
        }
      });

      // Generate share URL
      const shareUrl = `${window.location.origin}/room/${room}/patient`;
      setShareUrl(shareUrl);
      
      console.log('Generated share URL:', shareUrl);
      
      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast({
          kind: 'success',
          title: 'Room created',
          message: 'Patient link copied to clipboard.',
        });
      } catch {
        showToast({
          kind: 'info',
          title: 'Room created',
          message: 'Patient link is ready below. Copy it manually if needed.',
        });
      }
      
    } catch (error) {
      console.error('Error creating room:', error);
      setError('Error creating room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }, [db, room, showToast, user?.displayName, user?.email, user?.uid]);

  useEffect(() => {
    if (user && room && db) {
      void createRoom();
    }
  }, [createRoom, db, room, user]);

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
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>Telehealth Console</h1>
          <p style={{ fontSize: '1.25rem', color: '#4B5563', marginBottom: '2rem' }}>Please sign in to create a room</p>
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
            Room Created Successfully! 🎉
          </h1>
          <p style={{ fontSize: '1.125rem', color: '#6B7280', marginBottom: '0.5rem' }}>
            Room: <strong>{room}</strong>
          </p>
          <p style={{ fontSize: '1rem', color: '#9CA3AF' }}>
            Share the link below with your patient
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
              📋 Patient Link
            </h2>
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #D1D5DB',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1rem',
              wordBreak: 'break-all',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color: '#374151'
            }}>
              {shareUrl}
            </div>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  showToast({
                    kind: 'success',
                    title: 'Link copied',
                    message: 'Patient link copied to clipboard.',
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
            <Link href={`/room/${room}`} style={{
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
          <Link href="/doctor/history" style={{
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

'use client';
import { useEffect, useMemo, useState } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import { auth, db } from '@/lib/firebase';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, doc, serverTimestamp, setDoc, updateDoc, getFirestore } from 'firebase/firestore';
import Link from 'next/link';

// Force dynamic rendering to prevent build-time Firebase errors
export const dynamic = 'force-dynamic';

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [roomName, setRoomName] = useState<string>('');
  const [token, setToken] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState<boolean>(false);

  useEffect(() => {
    // Check if Firebase is initialized
    if (auth && db) {
      setIsFirebaseReady(true);
      return onAuthStateChanged(auth, (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        console.log('User details:', user);
        setUser(user);
      });
    } else {
      console.warn('Firebase not initialized');
    }
  }, []);

  // Debug logging
  console.log('Current user state:', user);
  console.log('Current token state:', token);
  console.log('Firebase ready:', isFirebaseReady);

  const provider = useMemo(() => new GoogleAuthProvider(), []);

  async function login() {
    if (!auth || !provider) {
      setError('Firebase not initialized. Please refresh the page.');
      return;
    }

    try {
      setError(null);
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Login error:', err.message);
      } else {
        console.error('Login error:', err);
      }
      setError('Failed to sign in. Please try again.');
    }
  }

  async function logout() {
    if (!auth) {
      setError('Firebase not initialized. Please refresh the page.');
      return;
    }

    try {
      await signOut(auth);
      setToken(null);
      setShareUrl('');
      setError(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Logout error:', err.message);
      } else {
        console.error('Logout error:', err);
      }
    }
  }

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      alert('Please enter a room name');
      return;
    }

    if (!db) {
      alert('Firebase not initialized. Please refresh the page.');
      return;
    }

    try {
      setIsCreating(true);
      
      // Store room creation with user ID
      const roomRef = doc(db, 'rooms', roomName);
      await setDoc(roomRef, {
        roomName,
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
      const shareUrl = `${window.location.origin}/room/${roomName}/patient`;
      setShareUrl(shareUrl);
      
      console.log('Generated share URL:', shareUrl);
      
      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('Room created! Share URL copied to clipboard.');
      } catch (err) {
        alert('Room created! Share URL: ' + shareUrl);
      }
      
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Error creating room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  async function joinRoom() {
    if (!user || !roomName) {
      setError('Please create a room first');
      return;
    }

    try {
      setIsJoining(true);
      setError(null);

      const identity = user.displayName || user.email || user.uid;

      // Get LiveKit token from API route
      const res = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantName: identity }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get token');
      }

      setToken(data.token);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join room';
      setError(errorMessage);
      console.error('Room join error:', err);
    } finally {
      setIsJoining(false);
    }
  }

  async function onDisconnected() {
    setToken(null);
    if (roomName && db) {
      try {
        await updateDoc(doc(db, 'calls', roomName), { 
          status: 'ended', 
          endedAt: serverTimestamp() 
        });
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.error('Error updating call status:', err.message);
        } else {
          console.error('Error updating call status:', err);
        }
      }
    }
  }

  // Loading state while Firebase initializes
  if (!isFirebaseReady) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>Telehealth Console</h1>
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
          <p style={{ fontSize: '1.25rem', color: '#4B5563', marginBottom: '2rem' }}>Sign in to create secure video consultation rooms</p>
          
          {error && (
            <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '0.5rem', color: '#DC2626', fontSize: '1rem' }}>
              {error}
            </div>
          )}
          
          <button 
            onClick={login} 
            style={{ width: '100%', backgroundColor: '#2563EB', color: 'white', padding: '1rem 2rem', borderRadius: '0.5rem', fontWeight: '600', fontSize: '1.25rem', border: 'none', cursor: 'pointer' }}
            onMouseOver={(e) => (e.target as HTMLElement).style.backgroundColor = '#1D4ED8'}
            onMouseOut={(e) => (e.target as HTMLElement).style.backgroundColor = '#2563EB'}
          >
            Sign in with Google
          </button>
          
          <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '2rem' }}>
            Secure • HIPAA Compliant • Professional
          </p>
        </div>
      </div>
    );
  }

  // Pre-join view
  if (!token) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB' }}>
        {/* Header */}
        <div style={{ backgroundColor: 'white', borderBottom: '1px solid #E5E7EB', padding: '1rem 2rem' }}>
          <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>Telehealth Console</h1>
              <p style={{ color: '#4B5563' }}>Welcome, Dr. {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <Link href="/dashboard" style={{ color: '#2563EB', fontSize: '1.125rem', fontWeight: '500', textDecoration: 'none' }}>
                View History
              </Link>
              <button 
                onClick={logout} 
                style={{ color: '#DC2626', fontSize: '1.125rem', fontWeight: '500', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>Create New Consultation Room</h2>
            <p style={{ fontSize: '1.125rem', color: '#4B5563', marginBottom: '2rem' }}>Enter a room name to start a secure video consultation.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '1.125rem', fontWeight: '500', color: '#374151', marginBottom: '0.75rem' }}>
                  Room Name
                </label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <input
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="e.g., dr-smith-aug15"
                    disabled={!!shareUrl}
                    style={{ 
                      flex: '1', 
                      border: '1px solid #D1D5DB', 
                      borderRadius: '0.5rem', 
                      padding: '1rem 1.25rem', 
                      fontSize: '1.125rem',
                      backgroundColor: shareUrl ? '#F9FAFB' : 'white',
                      color: shareUrl ? '#6B7280' : '#111827'
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && !shareUrl && handleCreateRoom()}
                  />
                  <button 
                    onClick={handleCreateRoom} 
                    disabled={isCreating || !roomName.trim() || !!shareUrl}
                    style={{ 
                      backgroundColor: isCreating || !roomName.trim() || shareUrl ? '#9CA3AF' : '#2563EB', 
                      color: 'white', 
                      padding: '1rem 2rem', 
                      borderRadius: '0.5rem', 
                      fontWeight: '600', 
                      fontSize: '1.125rem', 
                      border: 'none', 
                      cursor: isCreating || !roomName.trim() || shareUrl ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isCreating ? 'Creating...' : 'Create Room'}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ padding: '1.25rem', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '0.5rem', color: '#DC2626', fontSize: '1rem' }}>
                  {error}
                </div>
              )}

              {shareUrl && (
                <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '0.75rem' }}>Room Created Successfully!</h3>
                  <p style={{ fontSize: '1.125rem', color: '#4B5563', marginBottom: '1rem' }}>Share this link with your patient to start the consultation.</p>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <input value={shareUrl} readOnly style={{ flex: '1', border: '1px solid #D1D5DB', borderRadius: '0.5rem', padding: '0.75rem 1rem', backgroundColor: '#F9FAFB', fontSize: '1.125rem' }} />
                    <button
                      style={{ backgroundColor: '#2563EB', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: '600', fontSize: '1.125rem', border: 'none', cursor: 'pointer' }}
                      onClick={() => navigator.clipboard.writeText(shareUrl)}
                    >
                      Copy link
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      onClick={joinRoom}
                      disabled={isJoining}
                      style={{ 
                        backgroundColor: isJoining ? '#9CA3AF' : '#059669', 
                        color: 'white', 
                        padding: '1rem 2rem', 
                        borderRadius: '0.5rem', 
                        fontWeight: '600', 
                        fontSize: '1.125rem', 
                        border: 'none', 
                        cursor: isJoining ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isJoining ? 'Joining...' : 'Join Call'}
                    </button>
                    <button
                      onClick={() => {
                        setShareUrl('');
                        setRoomName('');
                      }}
                      style={{ 
                        backgroundColor: '#6B7280', 
                        color: 'white', 
                        padding: '1rem 2rem', 
                        borderRadius: '0.5rem', 
                        fontWeight: '600', 
                        fontSize: '1.125rem', 
                        border: 'none', 
                        cursor: 'pointer'
                      }}
                    >
                      Create New Room
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // In-call view
  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect
      audio
      video
      onDisconnected={onDisconnected}
      className="min-h-screen"
    >
      <VideoConference />
    </LiveKitRoom>
  );
}

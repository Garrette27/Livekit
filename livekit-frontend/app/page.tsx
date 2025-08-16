'use client';
import { useEffect, useMemo, useState } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import { auth, db } from '@/lib/firebase';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [roomName, setRoomName] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const provider = useMemo(() => new GoogleAuthProvider(), []);

  async function login() {
    try {
      setError(null);
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError('Failed to sign in. Please try again.');
      console.error('Login error:', err);
    }
  }

  async function logout() {
    try {
      await signOut(auth);
      setToken(null);
      setShareUrl('');
      setError(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  async function createOrJoinRoom() {
    if (!user) {
      setError('Please sign in first');
      return;
    }
    if (!roomName.trim()) {
      setError('Please enter a room name');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      const identity = user.displayName || user.email || user.uid;
      const cleanRoomName = roomName.trim().toLowerCase().replace(/\s+/g, '-');

      // Create a call doc (id = roomName)
      const callsRef = collection(db, 'calls');
      await setDoc(doc(callsRef, cleanRoomName), {
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        status: 'active',
        roomName: cleanRoomName,
        creatorName: user.displayName || user.email,
      }, { merge: true });

      // Generate token from our Next.js server route
      const res = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: cleanRoomName, participantName: identity }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get token');
      }

      setToken(data.token);
      setShareUrl(`${window.location.origin}/room/${encodeURIComponent(cleanRoomName)}`);
      setRoomName(cleanRoomName);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create room';
      setError(errorMessage);
      console.error('Room creation error:', err);
    } finally {
      setIsCreating(false);
    }
  }

  async function onDisconnected() {
    setToken(null);
    if (roomName) {
      try {
        await updateDoc(doc(db, 'calls', roomName), { 
          status: 'ended', 
          endedAt: serverTimestamp() 
        });
      } catch (err) {
        console.error('Error updating call status:', err);
      }
    }
  }

  // Signed-out view - Simple and clean
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

  // Pre-join view - Simple and clean
  if (!token) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB' }}>
        {/* Header with sign-out button */}
        <div style={{ backgroundColor: 'white', borderBottom: '1px solid #E5E7EB', padding: '1rem 2rem' }}>
          <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>Telehealth Console</h1>
              <p style={{ color: '#4B5563' }}>Welcome, Dr. {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <Link 
                href="/dashboard" 
                style={{ color: '#2563EB', fontSize: '1.125rem', fontWeight: '500', textDecoration: 'none' }}
                onMouseOver={(e) => (e.target as HTMLElement).style.textDecoration = 'underline'}
                onMouseOut={(e) => (e.target as HTMLElement).style.textDecoration = 'none'}
              >
                View History
              </Link>
              <button 
                onClick={logout} 
                style={{ color: '#DC2626', fontSize: '1.125rem', fontWeight: '500', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                onMouseOver={(e) => { 
                  const target = e.target as HTMLElement;
                  target.style.backgroundColor = '#FEF2F2'; 
                  target.style.textDecoration = 'underline'; 
                }}
                onMouseOut={(e) => { 
                  const target = e.target as HTMLElement;
                  target.style.backgroundColor = 'transparent'; 
                  target.style.textDecoration = 'none'; 
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>

        {/* Main content - centered */}
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem' }}>
          {/* Room Creation Form */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>Create New Consultation Room</h2>
            <p style={{ fontSize: '1.125rem', color: '#4B5563', marginBottom: '2rem' }}>Enter a room name to start a secure video consultation. Patients can join using the generated link.</p>
            
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
                    style={{ flex: '1', border: '1px solid #D1D5DB', borderRadius: '0.5rem', padding: '1rem 1.25rem', fontSize: '1.125rem' }}
                    onKeyPress={(e) => e.key === 'Enter' && createOrJoinRoom()}
                  />
                  <button 
                    onClick={createOrJoinRoom} 
                    disabled={isCreating || !roomName.trim()}
                    style={{ 
                      backgroundColor: isCreating || !roomName.trim() ? '#9CA3AF' : '#2563EB', 
                      color: 'white', 
                      padding: '1rem 2rem', 
                      borderRadius: '0.5rem', 
                      fontWeight: '600', 
                      fontSize: '1.125rem', 
                      border: 'none', 
                      cursor: isCreating || !roomName.trim() ? 'not-allowed' : 'pointer'
                    }}
                    onMouseOver={(e) => {
                      if (!isCreating && roomName.trim()) {
                        const target = e.target as HTMLElement;
                        target.style.backgroundColor = '#1D4ED8';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isCreating && roomName.trim()) {
                        const target = e.target as HTMLElement;
                        target.style.backgroundColor = '#2563EB';
                      }
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
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '0.75rem' }}>Patient Invitation Link</h3>
                  <p style={{ fontSize: '1.125rem', color: '#4B5563', marginBottom: '1rem' }}>Share this link with your patient to join the consultation room.</p>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <input
                      value={shareUrl}
                      readOnly
                      style={{ flex: '1', border: '1px solid #D1D5DB', borderRadius: '0.5rem', padding: '0.75rem 1rem', backgroundColor: '#F9FAFB', color: '#111827', fontSize: '1.125rem' }}
                    />
                    <button
                      style={{ backgroundColor: '#2563EB', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: '600', fontSize: '1.125rem', border: 'none', cursor: 'pointer' }}
                      onMouseOver={(e) => (e.target as HTMLElement).style.backgroundColor = '#1D4ED8'}
                      onMouseOut={(e) => (e.target as HTMLElement).style.backgroundColor = '#2563EB'}
                      onClick={() => navigator.clipboard.writeText(shareUrl)}
                    >
                      Copy link
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
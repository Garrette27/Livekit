'use client';

import { useEffect, useState } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import Link from 'next/link';
import { auth, provider } from '@/lib/firebase';
import { signInWithPopup, onAuthStateChanged, User, signOut } from 'firebase/auth';

// Client component for the doctor room functionality
function DoctorRoomClient({ roomName }: { roomName: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Handle authentication
  useEffect(() => {
    if (auth) {
      return onAuthStateChanged(auth, (user) => {
        setUser(user);
        setIsAuthenticated(!!user);
        console.log('Doctor auth state changed:', user ? 'Doctor signed in' : 'Doctor signed out');
      });
    }
  }, []);

  // Load doctor name from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem(`doctorName_${roomName}`);
    if (savedName) {
      setDoctorName(savedName);
    }
  }, [roomName]);

  const handleSignIn = async () => {
    if (!auth || !provider) {
      setError('Authentication not available');
      return;
    }

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      setUser(user);
      setIsAuthenticated(true);
      setDoctorName(user.displayName || user.email || 'Dr. Anonymous');
      localStorage.setItem(`doctorName_${roomName}`, user.displayName || user.email || 'Dr. Anonymous');
    } catch (error) {
      console.error('Sign in error:', error);
      setError('Failed to sign in. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      if (auth) {
        await signOut(auth);
        setUser(null);
        setIsAuthenticated(false);
        setDoctorName('');
        localStorage.removeItem(`doctorName_${roomName}`);
        localStorage.removeItem(`doctorToken_${roomName}`);
      }
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const generateDoctorToken = async () => {
    if (!doctorName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const response = await fetch('/api/doctor-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          doctorName,
          doctorEmail: user?.email || 'anonymous@example.com',
        }),
      });

      const data = await response.json();

      if (data.success && data.token) {
        setToken(data.token);
        localStorage.setItem(`doctorToken_${roomName}`, data.token);
        localStorage.setItem(`doctorName_${roomName}`, doctorName);
      } else {
        setError(data.error || 'Failed to generate doctor access token');
      }
    } catch (err) {
      console.error('Doctor token generation error:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleDisconnect = () => {
    setToken(null);
    localStorage.removeItem(`doctorToken_${roomName}`);
  };

  // Show authentication UI if not signed in
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '3rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '28rem',
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            backgroundColor: '#dbeafe',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 2rem'
          }}>
            <span style={{ fontSize: '2rem' }}>🩺</span>
          </div>

          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            color: '#1e40af',
            marginBottom: '1rem'
          }}>
            Doctor Access
          </h1>

          <p style={{
            fontSize: '1.125rem',
            color: '#6b7280',
            marginBottom: '2rem',
            lineHeight: '1.6'
          }}>
            Sign in to join the consultation as a doctor
          </p>

          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1.5rem',
              color: '#dc2626'
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSignIn}
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '1rem',
              marginBottom: '1rem',
              width: '100%'
            }}
          >
            Sign in with Google
          </button>

          <Link
            href="/invitations"
            style={{
              display: 'inline-block',
              color: '#6b7280',
              textDecoration: 'none',
              fontSize: '0.875rem'
            }}
          >
            ← Back to Invitations
          </Link>
        </div>
      </div>
    );
  }

  // Show name input if not set
  if (!doctorName.trim() && !token) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '3rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '28rem',
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            backgroundColor: '#dbeafe',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 2rem'
          }}>
            <span style={{ fontSize: '2rem' }}>👨‍⚕️</span>
          </div>

          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            color: '#1e40af',
            marginBottom: '1rem'
          }}>
            Welcome, Dr. {user?.displayName || user?.email || 'Anonymous'}
          </h1>

          <p style={{
            fontSize: '1.125rem',
            color: '#6b7280',
            marginBottom: '2rem',
            lineHeight: '1.6'
          }}>
            Enter your name to join the consultation
          </p>

          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1.5rem',
              color: '#dc2626'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="Dr. Your Name"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                textAlign: 'center'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  generateDoctorToken();
                }
              }}
            />
          </div>

          <button
            onClick={generateDoctorToken}
            disabled={isJoining}
            style={{
              backgroundColor: isJoining ? '#9ca3af' : '#059669',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              fontWeight: '600',
              cursor: isJoining ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              marginBottom: '1rem',
              width: '100%'
            }}
          >
            {isJoining ? 'Joining...' : 'Join Consultation'}
          </button>

          <button
            onClick={handleSignOut}
            style={{
              backgroundColor: 'transparent',
              color: '#6b7280',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #d1d5db',
              fontWeight: '500',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Show video interface
  if (token) {
    return (
      <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}>
        <LiveKitRoom
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://video-icebzbvf.livekit.cloud'}
          connect={true}
          audio
          video
          style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}
          onDisconnected={handleDisconnect}
          onError={(error) => {
            console.error('LiveKit error:', error);
            setError('Connection error. Please try again.');
          }}
        >
          <VideoConference />
          
          {/* Doctor Info Panel */}
          <div
            style={{
              position: 'fixed',
              top: '20px',
              left: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '2px solid #059669',
              borderRadius: '0.75rem',
              padding: '0.75rem 1rem',
              zIndex: 9999,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#059669', marginBottom: '0.25rem' }}>
              🩺 Dr. {doctorName}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Room: {roomName}
            </div>
          </div>

          {/* Leave Button */}
          <div
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 9999
            }}
          >
            <button
              onClick={() => {
                handleDisconnect();
                window.location.href = '/invitations';
              }}
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.9)',
                color: 'white',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.875rem',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }}
            >
              Leave Consultation
            </button>
          </div>
        </LiveKitRoom>

        {error && (
          <div
            style={{
              position: 'fixed',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              padding: '1rem',
              color: '#dc2626',
              zIndex: 9999,
              maxWidth: '400px',
              textAlign: 'center'
            }}
          >
            {error}
            <button
              onClick={() => setError(null)}
              style={{
                marginLeft: '1rem',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#dc2626',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>
    );
  }

  // Loading state
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
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
          Loading...
        </h2>
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

export default function DoctorRoomPage({ params }: { params: Promise<{ room: string }> }) {
  return (
    <div>
      <DoctorRoomClientWrapper params={params} />
    </div>
  );
}

function DoctorRoomClientWrapper({ params }: { params: Promise<{ room: string }> }) {
  const [roomName, setRoomName] = useState<string>('');

  useEffect(() => {
    params.then((resolvedParams) => {
      setRoomName(resolvedParams.room);
    });
  }, [params]);

  if (!roomName) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
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
            Loading...
          </h2>
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

  return (
    <DoctorRoomClient roomName={roomName} />
  );
}

'use client';

import { useEffect, useState } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import Link from 'next/link';
import { auth, provider } from '@/lib/firebase';
import { signInWithPopup, onAuthStateChanged, User, signOut } from 'firebase/auth';

// Client component for the patient room functionality
function PatientRoomClient({ roomName }: { roomName: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isInfoPanelCollapsed, setIsInfoPanelCollapsed] = useState<boolean>(false);

  // Check if fix control panel should be shown (when doctor has generated a link)
  const shouldShowFixControlPanel = () => {
    return localStorage.getItem(`doctorGeneratedLink_${roomName}`) === 'true';
  };

  // Handle authentication
  useEffect(() => {
    if (auth) {
      return onAuthStateChanged(auth, (user) => {
        setUser(user);
        setIsAuthenticated(!!user);
        console.log('Auth state changed:', user ? 'User signed in' : 'User signed out');
      });
    }
  }, []);

  // Load patient name from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem(`patientName_${roomName}`);
    if (savedName) {
      setPatientName(savedName);
    }
  }, [roomName]);

  // Check if patient was already in call
  useEffect(() => {
    const wasInCall = localStorage.getItem(`patientInCall_${roomName}`);
    const savedToken = localStorage.getItem(`patientToken_${roomName}`);
    if (wasInCall === 'true' && patientName && savedToken) {
      // Auto-rejoin if patient was previously in call
      setToken(savedToken);
    }
  }, [patientName, roomName]);

  // Function to handle Google sign-in
  const handleGoogleSignIn = async () => {
    try {
      if (auth && provider) {
        console.log('Attempting Google sign-in...');
        const result = await signInWithPopup(auth, provider);
        console.log('Google sign-in successful:', result.user.displayName);
      } else {
        console.error('Firebase auth or provider not initialized');
        alert('Authentication service not available. Please refresh the page.');
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      alert('Sign-in failed. Please try again.');
    }
  };

  // Function to join the room as a patient
  const handleJoinAsPatient = async () => {
    if (!patientName.trim()) {
      alert('Please enter your name');
      return;
    }

    try {
      setIsJoining(true);
      setError(null);

      // Save patient name to localStorage
      localStorage.setItem(`patientName_${roomName}`, patientName);
      localStorage.setItem(`patientInCall_${roomName}`, 'true');

      // Get LiveKit token from API route for patient
      const res = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomName, 
          participantName: `Patient: ${patientName}` 
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get token');
      }

      // Save token to localStorage for persistence
      localStorage.setItem(`patientToken_${roomName}`, data.token);
      setToken(data.token);

      // Track patient joining consultation
      try {
        await fetch('/api/track-consultation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            action: 'join',
            patientName
          }),
        });
      } catch (error) {
        console.error('Error tracking consultation join:', error);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join room';
      setError(errorMessage);
      console.error('Patient room join error:', err);
    } finally {
      setIsJoining(false);
    }
  };

  if (!token) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#F9FAFB',
        padding: '2rem'
      }}>
        {/* Header */}
        <div style={{ 
          backgroundColor: 'white', 
          borderBottom: '1px solid #E5E7EB', 
          padding: '1rem 2rem',
          marginBottom: '2rem',
          borderRadius: '0.75rem'
        }}>
          <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>Telehealth Consultation</h1>
              <p style={{ color: '#4B5563' }}>Room: {roomName}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <Link href="/" style={{ color: '#2563EB', fontSize: '1.125rem', fontWeight: '500', textDecoration: 'none' }}>
                Home
              </Link>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>Join Consultation</h2>
            <p style={{ fontSize: '1.125rem', color: '#4B5563', marginBottom: '2rem' }}>Welcome to your telehealth consultation. Please enter your name to join the call.</p>
            
            {/* Patient Name Input */}
            <div style={{ marginBottom: '2rem' }}>
              <label htmlFor="patientName" style={{ display: 'block', fontSize: '1.125rem', fontWeight: '500', color: '#374151', marginBottom: '0.75rem' }}>
                Your Name
              </label>
              <input
                id="patientName"
                name="patientName"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Enter your full name"
                style={{ 
                  width: '100%', 
                  border: '1px solid #D1D5DB', 
                  borderRadius: '0.5rem', 
                  padding: '1rem 1.25rem', 
                  fontSize: '1.125rem',
                  marginBottom: '1rem'
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleJoinAsPatient()}
              />
            </div>

            {/* Error Display */}
            {error && (
              <div style={{ 
                padding: '1.25rem', 
                backgroundColor: '#FEF2F2', 
                border: '1px solid #FECACA', 
                borderRadius: '0.5rem', 
                color: '#DC2626', 
                fontSize: '1rem',
                marginBottom: '2rem'
              }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Authentication Section */}
            {!isAuthenticated ? (
              <div style={{ 
                marginBottom: '2rem', 
                padding: '1.5rem', 
                backgroundColor: '#F0F9FF', 
                borderRadius: '0.5rem',
                border: '1px solid #BAE6FD'
              }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#0369A1', marginBottom: '0.75rem' }}>
                  🔐 Sign in with Google (Optional)
                </h3>
                <p style={{ color: '#0369A1', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  Sign in to save your consultation history and preferences.
                </p>
                <button
                  onClick={handleGoogleSignIn}
                  style={{ 
                    backgroundColor: '#4285F4', 
                    color: 'white', 
                    padding: '0.75rem 1.5rem', 
                    borderRadius: '0.5rem', 
                    fontWeight: '600', 
                    fontSize: '1rem', 
                    border: 'none', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 2px 4px rgba(66, 133, 244, 0.3)'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" style={{ fill: 'currentColor' }}>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </button>
              </div>
            ) : (
              <div style={{ 
                marginBottom: '2rem', 
                padding: '1.5rem', 
                backgroundColor: '#F0FDF4', 
                borderRadius: '0.5rem',
                border: '1px solid #BBF7D0'
              }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#166534', marginBottom: '0.75rem' }}>
                  ✅ Signed in as {user?.displayName || user?.email}
                </h3>
                <p style={{ color: '#166534', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  Your consultation history will be saved.
                </p>
                <button
                  onClick={() => auth && signOut(auth)}
                  style={{ 
                    backgroundColor: '#DC2626', 
                    color: 'white', 
                    padding: '0.5rem 1rem', 
                    borderRadius: '0.375rem', 
                    fontWeight: '500', 
                    fontSize: '0.875rem', 
                    border: 'none', 
                    cursor: 'pointer'
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}

            {/* Join Button */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                onClick={handleJoinAsPatient}
                disabled={isJoining || !patientName.trim()}
                style={{ 
                  backgroundColor: isJoining || !patientName.trim() ? '#9CA3AF' : '#2563EB', 
                  color: 'white', 
                  padding: '1rem 2rem', 
                  borderRadius: '0.5rem', 
                  fontWeight: '600', 
                  fontSize: '1.125rem', 
                  border: 'none', 
                  cursor: isJoining || !patientName.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {isJoining ? 'Joining...' : 'Join as Patient'}
              </button>
            </div>

            {/* Instructions */}
            <div style={{ 
              marginTop: '2rem', 
              padding: '1.5rem', 
              backgroundColor: '#F0F9FF', 
              borderRadius: '0.5rem',
              border: '1px solid #BAE6FD'
            }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#0369A1', marginBottom: '0.75rem' }}>
                📋 Before joining, please ensure:
              </h3>
              <ul style={{ color: '#0369A1', lineHeight: '1.6' }}>
                <li>You have a stable internet connection</li>
                <li>Your microphone and camera are working</li>
                <li>You're in a quiet, private location</li>
                <li>You have your medical information ready if needed</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Fix Control Panel - Only visible when doctor has generated a link */}
      {shouldShowFixControlPanel() && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#ffffff',
            border: '2px solid #059669',
            borderRadius: '0.75rem',
            padding: '1rem',
            zIndex: 10001,
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            maxWidth: isInfoPanelCollapsed ? '60px' : '320px',
            fontSize: '0.875rem',
            transition: 'max-width 0.3s ease',
            minHeight: '50px'
          }}
        >
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ 
                margin: '0', 
                color: '#059669', 
                fontSize: '1rem',
                fontWeight: '600'
              }}>
                🛠️ Fix Control Panel
              </h3>
              <button
                onClick={() => setIsInfoPanelCollapsed(!isInfoPanelCollapsed)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: '#059669',
                  padding: '0.25rem'
                }}
              >
                {isInfoPanelCollapsed ? '▶' : '◀'}
              </button>
            </div>
            {!isInfoPanelCollapsed && (
              <>
                <p style={{ 
                  margin: '0', 
                  color: '#6b7280', 
                  fontSize: '0.875rem',
                  marginBottom: '0.5rem'
                }}>
                  Connected as: {patientName || 'Patient'}
                </p>
                <p style={{ 
                  margin: '0', 
                  color: '#6b7280', 
                  fontSize: '0.875rem',
                  marginBottom: '0.75rem'
                }}>
                  Room: {roomName}
                </p>
              </>
            )}
          </div>
          
          {!isInfoPanelCollapsed && (
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              flexDirection: 'column'
            }}>
              <div style={{
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                padding: '0.5rem',
                fontSize: '0.75rem',
                color: '#374151',
                wordBreak: 'break-all',
                marginBottom: '0.5rem'
              }}>
                <strong>Patient Link:</strong><br />
                {`https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`}
              </div>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`);
                  alert('Patient link copied to clipboard!');
                }}
                style={{
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'inline-block',
                  textAlign: 'center'
                }}
              >
                📋 Copy Patient Link
              </button>
              
              <button
                onClick={() => {
                  // Clear the generated link flag
                  localStorage.removeItem(`doctorGeneratedLink_${roomName}`);
                  alert('Fix control panel hidden. Refresh to see changes.');
                }}
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'inline-block',
                  textAlign: 'center'
                }}
              >
                🗑️ Hide Panel
              </button>
            </div>
          )}
        </div>
      )}
      
      <LiveKitRoom
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://video-icebzbvf.livekit.cloud'}
        connect={true}
        audio
        video
        onDisconnected={() => {
          console.log('Patient disconnected from room');
          setToken(null);
          // Clear the in-call flag when disconnected
          localStorage.removeItem(`patientInCall_${roomName}`);
          localStorage.removeItem(`patientToken_${roomName}`);
          
          // Track patient leaving consultation
          fetch('/api/track-consultation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomName,
              action: 'leave',
              patientName
            }),
          }).catch(error => {
            console.error('Error tracking consultation leave:', error);
          });
          
          // Redirect to patient join page instead of main page
          window.location.href = `/room/${roomName}/patient`;
        }}
        onError={(error) => {
          console.error('LiveKit error:', error);
          setError('Connection error. Please try again.');
        }}
      >
        {/* Video Conference Component - This provides the actual video controls */}
        <VideoConference />
        {/* Force blue controls for patient view */}
        {token && (
          <div style={{ display: 'none' }}>
            <style jsx>{`
              /* Force ALL LiveKit controls to be blue */
              .lk-control-bar button,
              .lk-control-bar [data-lk-kind],
              .lk-button,
              .lk-button-group button,
              .lk-focus-toggle,
              .lk-device-menu,
              .lk-device-menu button,
              .lk-device-menu-item,
              .lk-device-menu-item button,
              [class*="lk-"] button,
              button[class*="lk-"],
              button[aria-label*="microphone"],
              button[aria-label*="camera"],
              button[aria-label*="chat"],
              button[aria-label*="leave"],
              button[aria-label*="share"] {
                background-color: #2563eb !important;
                color: white !important;
                border-color: #1d4ed8 !important;
                border-radius: 0.75rem !important;
                padding: 0.75rem 1rem !important;
                font-weight: 600 !important;
                min-width: 80px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 0.5rem !important;
                box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2) !important;
                z-index: 1000 !important;
                position: relative !important;
              }
              
              /* Force ALL LiveKit icons to be white */
              .lk-control-bar svg,
              .lk-button svg,
              [class*="lk-"] svg,
              button[aria-label*="microphone"] svg,
              button[aria-label*="camera"] svg,
              button[aria-label*="chat"] svg,
              button[aria-label*="leave"] svg,
              button[aria-label*="share"] svg {
                color: white !important;
                fill: white !important;
                stroke: white !important;
              }
              
              /* Force ALL LiveKit text to be white */
              .lk-control-bar span,
              .lk-button span,
              [class*="lk-"] span,
              button[aria-label*="microphone"] span,
              button[aria-label*="camera"] span,
              button[aria-label*="chat"] span,
              button[aria-label*="leave"] span,
              button[aria-label*="share"] span {
                color: white !important;
                font-weight: 600 !important;
              }
              
              /* Ensure control bar is visible */
              .lk-control-bar {
                position: fixed !important;
                bottom: 20px !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                z-index: 1000 !important;
                background-color: rgba(0, 0, 0, 0.8) !important;
                border-radius: 1rem !important;
                padding: 1rem !important;
                display: flex !important;
                gap: 0.5rem !important;
                align-items: center !important;
              }
              
              /* Ensure video elements are properly sized */
              .lk-video-conference {
                width: 100vw !important;
                height: 100vh !important;
                position: relative !important;
              }
              
              /* Ensure participant video is visible */
              .lk-participant-video {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
              }
            `}</style>
          </div>
        )}

        {/* Room Information Panel - Collapsible */}
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '2px solid #059669',
            borderRadius: '0.75rem',
            padding: '0.75rem',
            zIndex: 9999,
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            maxWidth: isInfoPanelCollapsed ? '60px' : '280px',
            fontSize: '0.875rem',
            transition: 'max-width 0.3s ease'
          }}
        >
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ 
                margin: '0', 
                color: '#047857', 
                fontSize: '1rem',
                fontWeight: '600'
              }}>
                🔗 Room Info
              </h3>
              <button
                onClick={() => setIsInfoPanelCollapsed(!isInfoPanelCollapsed)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: '#047857',
                  padding: '0.25rem'
                }}
              >
                {isInfoPanelCollapsed ? '▶' : '◀'}
              </button>
            </div>
            {!isInfoPanelCollapsed && (
              <>
                <p style={{ 
                  margin: '0', 
                  color: '#6b7280', 
                  fontSize: '0.875rem',
                  marginBottom: '0.5rem'
                }}>
                  Connected as: {patientName}
                </p>
                <p style={{ 
                  margin: '0', 
                  color: '#6b7280', 
                  fontSize: '0.875rem',
                  marginBottom: '0.75rem'
                }}>
                  Room: {roomName}
                </p>
              </>
            )}
          </div>
          
          {!isInfoPanelCollapsed && (
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              flexDirection: 'column'
            }}>
            <div style={{
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              padding: '0.375rem',
              fontSize: '0.7rem',
              color: '#374151',
              wordBreak: 'break-all',
              marginBottom: '0.5rem'
            }}>
              {`https://livekit-frontend-tau.vercel.app/room/${roomName}/patient`}
            </div>
            <button
              onClick={() => {
                // Clear current token and redirect to patient join page
                localStorage.removeItem(`patientToken_${roomName}`);
                localStorage.removeItem(`patientInCall_${roomName}`);
                setToken(null);
                window.location.href = `/room/${roomName}/patient`;
              }}
              style={{
                backgroundColor: '#6B7280',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                textDecoration: 'none',
                display: 'inline-block',
                textAlign: 'center'
              }}
            >
              Leave Call
            </button>
            

            
            {/* Join as Doctor Button */}
            <Link href={`/room/${roomName}`} style={{
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-block',
              textAlign: 'center',
              marginTop: '0.5rem'
            }}>
              Join as Doctor
            </Link>
            </div>
          )}
        </div>
      </LiveKitRoom>
    </div>
  );
}

// Server component that handles the params
export default async function PatientRoomPage({ params }: { params: Promise<{ room: string }> }) {
  const { room: roomName } = await params;
  
  return <PatientRoomClient roomName={roomName} />;
}

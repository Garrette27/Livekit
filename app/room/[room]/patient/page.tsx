'use client';

import { useEffect, useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import Link from 'next/link';
import { auth, provider } from '@/lib/firebase';
import { signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';

// Client component for the patient room functionality
function PatientRoomClient({ roomName }: { roomName: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string>('');
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
    if (wasInCall === 'true' && patientName) {
      // Auto-rejoin if patient was previously in call
      handleJoinAsPatient();
    }
  }, [patientName, roomName]);

  // Function to handle Google sign-in
  const handleGoogleSignIn = async () => {
    try {
      if (auth && provider) {
        await signInWithPopup(auth, provider);
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
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
              <label style={{ display: 'block', fontSize: '1.125rem', fontWeight: '500', color: '#374151', marginBottom: '0.75rem' }}>
                Your Name
              </label>
              <input
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
                {isJoining ? 'Joining...' : 'Join Consultation'}
              </button>
              
              {!isAuthenticated && (
                <button
                  onClick={handleGoogleSignIn}
                  style={{ 
                    backgroundColor: '#4285F4', 
                    color: 'white', 
                    padding: '1rem 2rem', 
                    borderRadius: '0.5rem', 
                    fontWeight: '600', 
                    fontSize: '1.125rem', 
                    border: 'none', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>G</span> Sign Up
                </button>
              )}
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
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://video-icebzbvf.livekit.cloud'}
      connect={true}
      onDisconnected={() => {
        console.log('Patient disconnected from room');
        setToken(null);
        // Clear the in-call flag when disconnected
        localStorage.removeItem(`patientInCall_${roomName}`);
        
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
      {/* Patient-specific controls - Full screen video interface */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '2px solid #059669',
          borderRadius: '0.75rem',
          padding: '1rem',
          zIndex: 9999,
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
          maxWidth: '300px'
        }}
      >
        <div style={{ marginBottom: '0.75rem' }}>
          <h3 style={{ 
            margin: '0 0 0.5rem 0', 
            color: '#047857', 
            fontSize: '1rem',
            fontWeight: '600'
          }}>
            👤 Patient View
          </h3>
          <p style={{ 
            margin: '0', 
            color: '#6b7280', 
            fontSize: '0.875rem',
            marginBottom: '0.75rem'
          }}>
            Connected as: {patientName}
          </p>
        </div>
        
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
            Room: {roomName}
          </div>
          <Link href={`/room/${roomName}/patient`} style={{
            backgroundColor: '#6B7280',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'inline-block'
          }}>
            Leave Call
          </Link>
        </div>
      </div>
    </LiveKitRoom>
  );
}

// Server component that handles the params
export default async function PatientRoomPage({ params }: { params: Promise<{ room: string }> }) {
  const { room: roomName } = await params;
  
  return <PatientRoomClient roomName={roomName} />;
}

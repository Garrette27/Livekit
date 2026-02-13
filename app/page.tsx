'use client';
import { useCallback, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { signOut, User } from 'firebase/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isDoctor } from '@/lib/auth-utils';
import { useAuthSession } from '@/hooks/useAuthSession';

// Force dynamic rendering to prevent build-time Firebase errors
export const dynamic = 'force-dynamic';

export default function Page() {
  const [roomName, setRoomName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState<boolean>(false);
  const router = useRouter();

  const handleAuthenticated = useCallback(async (authenticatedUser: User) => {
    console.log('Auth state changed: User logged in');
    console.log('User details:', authenticatedUser);
    const doctor = await isDoctor(authenticatedUser);
    if (doctor) {
      router.replace('/doctor/invitations');
    }
  }, [router]);

  const { user, isLoading: authLoading } = useAuthSession({
    onAuthenticated: handleAuthenticated,
  });

  useEffect(() => {
    // Check if Firebase is initialized
    if (auth && db) {
      setIsFirebaseReady(true);
    } else {
      console.warn('Firebase not initialized');
    }
  }, []);

  // Debug logging
  console.log('Current user state:', user);
  console.log('Firebase ready:', isFirebaseReady);

  async function logout() {
    if (!auth) {
      setError('Firebase not initialized. Please refresh the page.');
      return;
    }

    try {
      await signOut(auth);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Logout error:', err.message);
      } else {
        console.error('Logout error:', err);
      }
    }
  }

  function joinRoom() {
    const nextRoomName = roomName.trim();
    if (!nextRoomName) {
      setError('Please enter a room name to join.');
      return;
    }

    setError(null);
    router.push(`/room/${nextRoomName}/patient`);
  }

  // Loading state while Firebase initializes
  if (!isFirebaseReady || authLoading) {
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

  // Signed-out view - Show role selection
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '40rem', width: '100%' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>Telehealth Console</h1>
          <p style={{ fontSize: '1.125rem', color: '#6B7280', marginBottom: '3rem' }}>
            Secure video consultation platform
          </p>
          
          {error && (
            <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '0.5rem', color: '#DC2626', fontSize: '1rem' }}>
              {error}
            </div>
          )}
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '2rem',
            marginBottom: '2rem'
          }}>
            {/* Doctor Sign In */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '1rem',
              padding: '2rem',
              border: '2px solid #dbeafe',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{
                width: '4rem',
                height: '4rem',
                backgroundColor: '#dbeafe',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem'
              }}>
                <span style={{ fontSize: '2rem' }}>🩺</span>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e40af', marginBottom: '0.5rem' }}>
                For Doctors
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                Create rooms, manage invitations, and view consultation history
              </p>
              <Link
                href="/doctor/login"
                style={{
                  display: 'block',
                  width: '100%',
                  backgroundColor: '#2563EB',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  fontWeight: '600',
                  fontSize: '1rem',
                  textDecoration: 'none',
                  textAlign: 'center'
                }}
              >
                Sign in as Doctor
              </Link>
            </div>

            {/* Patient Sign In */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '1rem',
              padding: '2rem',
              border: '2px solid #dcfce7',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{
                width: '4rem',
                height: '4rem',
                backgroundColor: '#dcfce7',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem'
              }}>
                <span style={{ fontSize: '2rem' }}>👤</span>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#166534', marginBottom: '0.5rem' }}>
                For Patients
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                View your consultation history and summaries
              </p>
              <Link
                href="/patient/login"
                style={{
                  display: 'block',
                  width: '100%',
                  backgroundColor: '#059669',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  fontWeight: '600',
                  fontSize: '1rem',
                  textDecoration: 'none',
                  textAlign: 'center'
                }}
              >
                Sign in as Patient
              </Link>
            </div>
          </div>

          <div style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            marginTop: '2rem'
          }}>
            <p style={{ fontSize: '0.875rem', color: '#1e40af', margin: 0, lineHeight: '1.6' }}>
              <strong>Note for Patients:</strong> You can also join consultations directly using invitation links from your doctor without signing in. Sign in is optional and allows you to view your consultation history.
            </p>
          </div>
          
          <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '2rem' }}>
            Secure • Data Privacy (Philippines) Compliant • Professional
          </p>
        </div>
      </div>
    );
  }

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
            <Link
              href="/dashboard"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                padding: 0,
                color: '#2563EB',
                fontSize: '1.125rem',
                fontWeight: '500',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
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

      {/* Main content - Join Room Section Only (Create Room removed for doctors) */}
      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>Join Existing Room</h2>
          <p style={{ fontSize: '1.125rem', color: '#4B5563', marginBottom: '2rem' }}>
            Have a room link? Enter the room name to join as a patient.
          </p>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <input
              value={roomName}
              onChange={(event) => {
                setRoomName(event.target.value);
                setError(null);
              }}
              placeholder="Enter room name to join"
              style={{
                flex: '1',
                border: '1px solid #D1D5DB',
                borderRadius: '0.5rem',
                padding: '1rem 1.25rem',
                fontSize: '1.125rem',
                backgroundColor: 'white',
                color: '#111827'
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  joinRoom();
                }
              }}
            />
            <button
              onClick={joinRoom}
              style={{
                backgroundColor: '#059669',
                color: 'white',
                padding: '1rem 2rem',
                borderRadius: '0.5rem',
                fontWeight: '600',
                fontSize: '1.125rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Join Room
            </button>
          </div>
          {error && (
            <p style={{ color: '#DC2626', marginTop: '0.75rem', marginBottom: 0 }}>{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

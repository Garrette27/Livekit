'use client';

import { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { getUserRole } from '@/lib/auth-utils';
import { useAuthSession } from '@/hooks/useAuthSession';

export const dynamic = 'force-dynamic';

export default function Page() {
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleAuthenticated = useCallback(
    async (authenticatedUser: User) => {
      const role = await getUserRole(authenticatedUser);
      if (role === 'doctor') {
        router.replace('/doctor/invitations');
        return;
      }

      if (role === 'patient') {
        router.replace('/patient/dashboard');
        return;
      }

      router.replace('/patient/login');
    },
    [router]
  );

  const { user, isLoading: authLoading } = useAuthSession({
    onAuthenticated: handleAuthenticated,
  });

  useEffect(() => {
    if (auth && db) {
      setIsFirebaseReady(true);
      return;
    }

    setError('Firebase is not initialized. Please refresh the page.');
  }, []);

  if (!isFirebaseReady || authLoading || user) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f9fafb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '1rem',
            }}
          >
            Telehealth Console
          </h1>
          <p style={{ fontSize: '1rem', color: '#4b5563', marginBottom: '1.5rem' }}>
            {user ? 'Redirecting to your dashboard...' : 'Loading...'}
          </p>
          <div
            style={{
              width: '2rem',
              height: '2rem',
              border: '3px solid #e5e7eb',
              borderTop: '3px solid #2563eb',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto',
            }}
          />
          {error && (
            <p style={{ color: '#dc2626', marginTop: '1rem', fontSize: '0.875rem' }}>{error}</p>
          )}
        </div>
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

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '40rem', width: '100%' }}>
        <h1
          style={{
            fontSize: '2.25rem',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '1rem',
          }}
        >
          Telehealth Console
        </h1>
        <p style={{ fontSize: '1.125rem', color: '#6b7280', marginBottom: '3rem' }}>
          Secure video consultation platform
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '1rem',
              padding: '2rem',
              border: '2px solid #dbeafe',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e40af', marginBottom: '0.5rem' }}>
              For Doctors
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Create rooms, manage invitations, and view consultation history.
            </p>
            <Link
              href="/doctor/login"
              style={{
                display: 'block',
                width: '100%',
                backgroundColor: '#2563eb',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                fontWeight: '600',
                fontSize: '1rem',
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              Sign in as Doctor
            </Link>
          </div>

          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '1rem',
              padding: '2rem',
              border: '2px solid #dcfce7',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#166534', marginBottom: '0.5rem' }}>
              For Patients
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Join consultations and view your consultation history.
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
                textAlign: 'center',
              }}
            >
              Sign in as Patient
            </Link>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            marginTop: '2rem',
          }}
        >
          <p style={{ fontSize: '0.875rem', color: '#1e40af', margin: 0, lineHeight: '1.6' }}>
            <strong>Note for patients:</strong> You can join consultations directly through invitation links even
            without signing in.
          </p>
        </div>
      </div>
    </div>
  );
}

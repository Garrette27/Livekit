'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/hooks/useAuthSession';
import { getUserRole } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

// Legacy route kept as a compatibility alias only.
export default function LegacyDashboardAlias() {
  const router = useRouter();
  const { user, isLoading } = useAuthSession();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user) {
      router.replace('/doctor/login');
      return;
    }

    void getUserRole(user).then((role) => {
      if (role === 'doctor') {
        router.replace('/doctor/history');
        return;
      }
      if (role === 'patient') {
        router.replace('/patient/dashboard');
        return;
      }
      router.replace('/');
    });
  }, [isLoading, router, user]);

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
            width: '3rem',
            height: '3rem',
            border: '2px solid #dbeafe',
            borderTop: '2px solid #2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem',
          }}
        />
        <p style={{ color: '#4b5563' }}>Redirecting...</p>
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

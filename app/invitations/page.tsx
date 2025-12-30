'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InvitationsPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the new doctor invitations page
    router.replace('/doctor/invitations');
  }, [router]);

  // Show loading state while redirecting
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F9FAFB',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        textAlign: 'center'
      }}>
        <p style={{ color: '#6B7280' }}>Redirecting to invitations...</p>
      </div>
    </div>
  );
}

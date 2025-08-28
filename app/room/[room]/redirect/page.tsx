'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RedirectPage({ params }: { params: Promise<{ room: string }> }) {
  const router = useRouter();

  useEffect(() => {
    const redirectToPatient = async () => {
      const { room } = await params;
      router.replace(`/room/${room}/patient`);
    };

    redirectToPatient();
  }, [params, router]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '1.2rem',
      color: '#6b7280'
    }}>
      Redirecting to patient interface...
    </div>
  );
}

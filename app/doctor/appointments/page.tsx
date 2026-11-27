'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/hooks/useAuthSession';
import DoctorAppHeader from '@/components/doctor/DoctorAppHeader';
import AppointmentWorkbench from './components/AppointmentWorkbench';

/** Clinical workspace access is resolved before any appointment query mounts. */
export default function DoctorAppointmentsPage() {
  const { user, isAuthenticated, isAuthorized, isLoading } = useAuthSession({ requiredRole: 'doctor' });
  const router = useRouter();
  useEffect(() => { if (!isLoading && !isAuthenticated) router.replace('/doctor/login'); }, [isLoading, isAuthenticated, router]);
  if (isLoading) return <main style={{ padding: '2rem' }} role="status">Checking doctor access…</main>;
  if (!user || !isAuthorized) return <main style={{ padding: '2rem' }}><p>Doctor access could not be confirmed.</p><a href="/admin">Administration</a> · <a href="/doctor/login">Doctor sign in</a></main>;
  return <div style={{ minHeight: '100vh', background: '#f5f8f7' }}><DoctorAppHeader title="Appointments" subtitle="Plan patient visits" user={user} navLink={{ href: '/doctor/invitations', label: 'Invitations' }} /><main style={{ maxWidth: '64rem', margin: '0 auto', padding: 'var(--page-padding, 1rem)' }}><AppointmentWorkbench key={user.uid} doctorUserId={user.uid} /></main></div>;
}

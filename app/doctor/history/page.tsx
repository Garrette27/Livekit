import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Keep legacy /doctor/history URLs working while the canonical history page
 * stays at /doctor/dashboard.
 */
export default function DoctorHistoryAliasPage() {
  redirect('/doctor/dashboard');
}

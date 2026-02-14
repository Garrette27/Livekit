import { redirect } from 'next/navigation';
import { getDoctorHistoryRoute } from '@/lib/routes/doctor-routes';

export const dynamic = 'force-dynamic';

/**
 * Keep legacy /doctor/history URLs working while the canonical history page
 * stays at /doctor/dashboard.
 */
export default function DoctorHistoryAliasPage() {
  redirect(getDoctorHistoryRoute());
}

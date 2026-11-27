import { NextResponse } from 'next/server';
import { authenticateBearerToken } from '@/lib/services/shared/request-auth';
import { serviceResultToResponse } from '@/lib/services/shared/http';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { parseSuperAdminEmails, resolveWorkspaceAccess } from '@/lib/auth/role-administration';
import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { isConsultationCapabilityEnabled } from '@/lib/consultations/consultation-capabilities';

/** Private navigation projection only; domain endpoints still enforce permissions and ownership. */
async function handleGET(req: Request) {
  const caller = await authenticateBearerToken(req);
  if (!caller.ok) return serviceResultToResponse(caller);
  const supers = parseSuperAdminEmails(process.env.SUPER_ADMIN_EMAILS);
  let access = resolveWorkspaceAccess(caller.data, supers);
  if (!access.homePath && !caller.data.claimedRole) {
    const db = getFirebaseAdmin();
    if (!db) return NextResponse.json({ success: false, error: 'Account service unavailable.' }, { status: 503 });
    const profile = await db.collection('users').doc(caller.data.userId).get();
    access = resolveWorkspaceAccess(caller.data, supers, profile.data()?.role);
  }
  return NextResponse.json({ success: true, ...access, schedulingEnabled: access.doctorAccess && isConsultationCapabilityEnabled('scheduling') }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export const GET = withRequestLogging(handleGET);

import { NextRequest, NextResponse } from 'next/server';
import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { authenticateBearerToken } from '@/lib/services/shared/request-auth';
import { serviceResultToResponse } from '@/lib/services/shared/http';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { enforceRateLimit, RateLimitConfigs } from '@/lib/rate-limit';
import { administratorLevel, parseSuperAdminEmails } from '@/lib/auth/role-administration';
import { buildInvitationActivity } from '@/lib/services/admin/invitation-activity-service';

/**
 * GET: newest invitations with the creating doctor and the visits each one
 * received. Scope comes only from the verified caller (platform owner: all;
 * clinic administrator: doctors in their clinic). Patient names, emails and
 * clinical content are never returned. Separate from /api/admin/oversight so
 * a failure here never hides the counts or staff management.
 */
async function handleGET(req: NextRequest) {
  const caller = await authenticateBearerToken(req);
  if (!caller.ok) return serviceResultToResponse(caller);
  const level = administratorLevel(caller.data, parseSuperAdminEmails(process.env.SUPER_ADMIN_EMAILS));
  if (!level) {
    return NextResponse.json({ success: false, code: 'not_administrator', error: 'Only an administrator can view invitation activity.' }, { status: 403 });
  }
  const limited = await enforceRateLimit(req, RateLimitConfigs.GENERAL);
  if (limited) return limited;
  const db = getFirebaseAdmin();
  if (!db) return NextResponse.json({ success: false, error: 'Service unavailable' }, { status: 503 });
  try {
    const snapshot = await buildInvitationActivity(db, level === 'super_admin' ? { level } : { level, clinicId: caller.data.clinicId ?? null });
    return NextResponse.json({ success: true, ...snapshot }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Invitation activity failed:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ success: false, error: 'Invitation activity is temporarily unavailable.' }, { status: 503 });
  }
}

export const GET = withRequestLogging(handleGET);

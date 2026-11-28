import { NextRequest, NextResponse } from 'next/server';
import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { authenticateBearerToken } from '@/lib/services/shared/request-auth';
import { serviceResultToResponse } from '@/lib/services/shared/http';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { enforceRateLimit, RateLimitConfigs } from '@/lib/rate-limit';
import { administratorLevel, parseSuperAdminEmails } from '@/lib/auth/role-administration';
import { buildOversightSnapshot } from '@/lib/services/admin/oversight-service';

/**
 * GET: administrator oversight snapshot (aggregate counts + recent audit
 * events). Scope comes only from the verified caller: platform owner sees
 * platform-wide metadata, a clinic administrator only their clinic. Doctors,
 * patients and anonymous callers are refused. No clinical content is returned.
 */
async function handleGET(req: NextRequest) {
  const caller = await authenticateBearerToken(req);
  if (!caller.ok) return serviceResultToResponse(caller);
  const level = administratorLevel(caller.data, parseSuperAdminEmails(process.env.SUPER_ADMIN_EMAILS));
  if (!level) {
    return NextResponse.json({ success: false, code: 'not_administrator', error: 'Only an administrator can view oversight.' }, { status: 403 });
  }
  const limited = await enforceRateLimit(req, RateLimitConfigs.GENERAL);
  if (limited) return limited;
  const db = getFirebaseAdmin();
  if (!db) return NextResponse.json({ success: false, error: 'Service unavailable' }, { status: 503 });
  try {
    const snapshot = await buildOversightSnapshot(db, level === 'super_admin' ? { level } : { level, clinicId: caller.data.clinicId ?? null });
    return NextResponse.json({ success: true, ...snapshot }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    // A missing index or quota error must not break the staff-management page.
    console.error('Oversight snapshot failed:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ success: false, error: 'Oversight is temporarily unavailable. Staff management still works.' }, { status: 503 });
  }
}

export const GET = withRequestLogging(handleGET);

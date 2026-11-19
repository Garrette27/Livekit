import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextResponse } from 'next/server';
import { authorizeBearerRequest } from '@/lib/services/shared/request-auth';
import { serviceResultToResponse } from '@/lib/services/shared/http';

/**
 * Acknowledge obsolete browser linking requests without changing ownership.
 * Admission establishes patient identity on the server; cached session IDs,
 * invitation allowlists, and matching emails cannot prove historical attendance.
 * Keeping this authenticated, idempotent response lets existing clients clear
 * their old pending-ID cache without claiming another patient's encounter.
 */
async function handlePOST(req: Request) {
  const auth = await authorizeBearerRequest(req, 'consultation:link-own');
  if (!auth.ok) {
    return serviceResultToResponse(auth);
  }

  return NextResponse.json({
    success: true,
    linkedCount: 0,
    linkedSessionCount: 0,
    message: 'Patient history uses the identity recorded during admission.',
  });
}

export const POST = withRequestLogging(handlePOST);

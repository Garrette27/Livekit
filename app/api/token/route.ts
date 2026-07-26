import { NextRequest } from 'next/server';
import { serviceResultToResponse } from '@/lib/services/shared/http';
import { authorizeBearerRequest } from '@/lib/services/shared/request-auth';
import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { serviceError } from '@/lib/services/shared/service-result';

/**
 * Legacy direct patient-room token minting is intentionally closed. Patient
 * LiveKit credentials are issued only while validating a signed invitation.
 */
async function handlePOST(req: NextRequest) {
  const auth = await authorizeBearerRequest(req, 'room:join-patient');
  if (!auth.ok) {
    return serviceResultToResponse(auth);
  }

  return serviceResultToResponse(
    serviceError(
      403,
      'invitation_required',
      'A signed patient invitation is required to join a consultation'
    )
  );
}

export const POST = withRequestLogging(handlePOST);

import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { authenticateBearerToken } from '../../../../lib/services/shared/request-auth';
import { serviceResultToResponse } from '../../../../lib/services/shared/http';
import { serviceError } from '../../../../lib/services/shared/service-result';
import { FirestoreSummaryManagementCore } from '../../../../lib/services/summary-management';

async function handleDELETE(req: NextRequest) {
  const auth = await authenticateBearerToken(req);
  if (!auth.ok) {
    return serviceResultToResponse(auth);
  }

  const summaryId = new URL(req.url).searchParams.get('id');
  if (!summaryId) {
    return serviceResultToResponse(serviceError(400, 'missing_summary_id', 'Summary ID is required'));
  }

  const db = getFirebaseAdmin();
  if (!db) {
    return serviceResultToResponse(serviceError(500, 'db_unavailable', 'Firebase not initialized'));
  }

  const result = await new FirestoreSummaryManagementCore(db).deleteSummary({
    summaryId,
    requesterUserId: auth.data!.userId,
  });
  return serviceResultToResponse(result);
}

export const DELETE = withRequestLogging(handleDELETE);

import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { authorizeBearerRequest } from '../../../../lib/services/shared/request-auth';
import { serviceResultToResponse } from '../../../../lib/services/shared/http';
import { serviceError } from '../../../../lib/services/shared/service-result';
import { FirestoreSummaryManagementCore } from '../../../../lib/services/summary-management';

async function handlePUT(req: NextRequest) {
  const auth = await authorizeBearerRequest(req, 'summary:manage-own');
  if (!auth.ok) {
    return serviceResultToResponse(auth);
  }

  const body = await req.json();
  const { summaryId, summary, keyPoints, recommendations, followUpActions, riskLevel, category } = body;
  if (!summaryId) {
    return serviceResultToResponse(serviceError(400, 'missing_summary_id', 'Summary ID is required'));
  }

  const db = getFirebaseAdmin();
  if (!db) {
    return serviceResultToResponse(serviceError(500, 'db_unavailable', 'Database not initialized'));
  }

  const result = await new FirestoreSummaryManagementCore(db).updateSummary({
    summaryId,
    editorUserId: auth.data!.userId,
    fields: { summary, keyPoints, recommendations, followUpActions, riskLevel, category },
  });
  return serviceResultToResponse(result);
}

export const PUT = withRequestLogging(handlePUT);

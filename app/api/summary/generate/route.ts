import { NextRequest } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { ConsultationSessionRepository } from '@/lib/repositories/consultation-session-repository';
import { FirestoreSummaryProjectionService } from '@/lib/services/history-summary';
import { serviceResultToResponse } from '@/lib/services/shared/http';
import { authorizeBearerRequest } from '@/lib/services/shared/request-auth';
import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { serviceError, serviceOk } from '@/lib/services/shared/service-result';

export const maxDuration = 60;

/**
 * Retries summary generation for one completed consultation owned by the
 * requesting doctor. This repairs historical sessions without exposing the
 * summary generator or another doctor's records directly to the browser.
 */
async function handlePOST(req: NextRequest) {
  const auth = await authorizeBearerRequest(req, 'summary:manage-own');
  if (!auth.ok) {
    return serviceResultToResponse(auth);
  }

  const body = (await req.json()) as { consultationSessionId?: unknown };
  const consultationSessionId =
    typeof body.consultationSessionId === 'string' ? body.consultationSessionId.trim() : '';
  if (!consultationSessionId) {
    return serviceResultToResponse(
      serviceError(400, 'missing_consultation_session_id', 'Consultation session ID is required')
    );
  }

  const db = getFirebaseAdmin();
  if (!db) {
    return serviceResultToResponse(serviceError(500, 'db_unavailable', 'Database not initialized'));
  }

  const sessionDoc = await new ConsultationSessionRepository(db).getById(consultationSessionId);
  if (!sessionDoc.exists) {
    return serviceResultToResponse(
      serviceError(404, 'consultation_not_found', 'Consultation session not found')
    );
  }

  const session = sessionDoc.data() as Record<string, unknown>;
  const metadata = (session.metadata as Record<string, unknown> | undefined) || {};
  const ownerUserId = session.doctorUserId || metadata.createdBy;
  if (ownerUserId !== auth.data.userId && auth.data.role !== 'admin') {
    return serviceResultToResponse(
      serviceError(403, 'consultation_forbidden', 'You cannot generate this consultation summary')
    );
  }

  const status = typeof session.status === 'string' ? session.status.trim().toLowerCase() : '';
  const hasEndedAt = Boolean(session.sessionEndedAt || metadata.sessionEndedAt);
  if (status !== 'completed' && !hasEndedAt) {
    return serviceResultToResponse(
      serviceError(409, 'consultation_active', 'A consultation must end before its summary is generated')
    );
  }

  const result = await new FirestoreSummaryProjectionService(db).buildSummary({
    consultationSessionId,
    regenerate: true,
  });
  if (!result.summary) {
    return serviceResultToResponse(
      serviceError(500, 'summary_not_generated', 'The consultation summary could not be generated')
    );
  }

  return serviceResultToResponse(serviceOk({
    summaryId: result.summaryId,
    summary: result.summary,
  }));
}

export const POST = withRequestLogging(handlePOST);

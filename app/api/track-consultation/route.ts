import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { serviceResultToResponse } from '@/lib/services/shared/http';
import { serviceError } from '@/lib/services/shared/service-result';
import { FirestoreConsultationTrackingCore } from '@/lib/services/consultation-tracking';
import type { ConsultationAction } from '@/lib/services/consultation-tracking';

// Leave events can trigger finalization + AI summarization; give them more
// than the 10s default.
export const maxDuration = 60;

interface TrackConsultationRequest {
  roomName?: string;
  action?: ConsultationAction;
  patientName?: string;
  userId?: string;
  patientEmail?: string;
  consultationSessionId?: string;
}

// Accepts both JSON and form-encoded bodies (the latter from sendBeacon on
// tab-close). Parsing is an HTTP concern; all tracking logic lives in the service.
async function parseRequest(req: Request): Promise<TrackConsultationRequest | null> {
  const rawBody = await req.text();
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as TrackConsultationRequest;
  } catch {
    const params = new URLSearchParams(rawBody);
    const action = params.get('action');
    return {
      roomName: params.get('roomName') || undefined,
      action: action === 'join' || action === 'leave' ? action : undefined,
      patientName: params.get('patientName') || undefined,
      userId: params.get('userId') || undefined,
      patientEmail: params.get('patientEmail') || undefined,
      consultationSessionId: params.get('consultationSessionId') || undefined,
    };
  }
}

async function handlePOST(req: Request) {
  try {
    const body = await parseRequest(req);
    if (!body) {
      return serviceResultToResponse(serviceError(400, 'missing_body', 'Request body is required'));
    }

    const roomName = body.roomName?.trim();
    const action = body.action;
    if (!roomName || !action) {
      return serviceResultToResponse(serviceError(400, 'missing_fields', 'roomName and action are required'));
    }
    if (action !== 'join' && action !== 'leave') {
      return serviceResultToResponse(serviceError(400, 'unsupported_action', `Unsupported action: ${action}`));
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return serviceResultToResponse(serviceError(500, 'db_unavailable', 'Firebase Admin not initialized'));
    }

    const result = await new FirestoreConsultationTrackingCore(db).trackConsultation({
      roomName,
      action,
      patientName: body.patientName?.trim() || 'Unknown Patient',
      userId: body.userId?.trim() || 'anonymous',
      patientEmail: body.patientEmail?.trim().toLowerCase() || undefined,
      consultationSessionId: body.consultationSessionId?.trim() || undefined,
    });
    return serviceResultToResponse(result);
  } catch (error) {
    console.error('Track consultation error:', error);
    return serviceResultToResponse(
      serviceError(
        500,
        'track_failed',
        'Failed to track consultation',
        error instanceof Error ? error.message : 'Unknown error'
      )
    );
  }
}

export const POST = withRequestLogging(handlePOST);

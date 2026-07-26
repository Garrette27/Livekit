import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { serviceResultToResponse } from '@/lib/services/shared/http';
import { serviceError } from '@/lib/services/shared/service-result';
import { FirestoreConsultationTrackingCore } from '@/lib/services/consultation-tracking';
import type { ConsultationAction } from '@/lib/services/consultation-tracking';
import { verifyLiveKitRoomToken } from '@/lib/invitations/token-utils';

// Leave events can trigger finalization + AI summarization; give them more
// than the 10s default.
export const maxDuration = 60;

interface TrackConsultationRequest {
  accessToken?: string;
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
      accessToken: params.get('accessToken') || undefined,
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

    const accessToken = body.accessToken?.trim();
    if (!accessToken) {
      return serviceResultToResponse(
        serviceError(401, 'missing_room_token', 'LiveKit room token is required')
      );
    }

    let participant;
    try {
      participant = verifyLiveKitRoomToken(accessToken);
    } catch {
      return serviceResultToResponse(
        serviceError(401, 'invalid_room_token', 'LiveKit room token is invalid or expired')
      );
    }

    if (!participant.identity.startsWith('patient_')) {
      return serviceResultToResponse(
        serviceError(403, 'patient_token_required', 'A patient room token is required')
      );
    }

    const roomName = body.roomName?.trim();
    const action = body.action;
    if (!roomName || !action) {
      return serviceResultToResponse(serviceError(400, 'missing_fields', 'roomName and action are required'));
    }
    if (action !== 'join' && action !== 'leave') {
      return serviceResultToResponse(serviceError(400, 'unsupported_action', `Unsupported action: ${action}`));
    }
    if (participant.roomName !== roomName) {
      return serviceResultToResponse(
        serviceError(403, 'room_token_mismatch', 'Room token does not grant access to this consultation')
      );
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return serviceResultToResponse(serviceError(500, 'db_unavailable', 'Firebase Admin not initialized'));
    }

    const result = await new FirestoreConsultationTrackingCore(db).trackConsultation({
      roomName,
      action,
      patientName: participant.participantName?.trim() || 'Patient',
      userId: participant.identity,
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

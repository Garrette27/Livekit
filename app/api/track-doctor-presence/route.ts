import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { serviceResultToResponse } from '@/lib/services/shared/http';
import { serviceError } from '@/lib/services/shared/service-result';
import { FirestoreDoctorPresenceCore } from '@/lib/services/doctor-presence';
import type { DoctorPresenceAction } from '@/lib/services/doctor-presence';

interface TrackDoctorPresenceRequest {
  roomName?: string;
  action?: DoctorPresenceAction;
  doctorUserId?: string;
  doctorName?: string | null;
  doctorEmail?: string | null;
  consultationSessionId?: string | null;
}

export async function POST(req: Request) {
  const body = (await req.json()) as TrackDoctorPresenceRequest;
  const roomName = body.roomName?.trim();
  const action = body.action;
  const doctorUserId = body.doctorUserId?.trim();

  if (!roomName || !action || !doctorUserId) {
    return serviceResultToResponse(
      serviceError(400, 'missing_fields', 'roomName, action, and doctorUserId are required')
    );
  }
  if (action !== 'join' && action !== 'leave') {
    return serviceResultToResponse(serviceError(400, 'unsupported_action', `Unsupported action: ${action}`));
  }

  const db = getFirebaseAdmin();
  if (!db) {
    return serviceResultToResponse(serviceError(500, 'db_unavailable', 'Firebase Admin not initialized'));
  }

  const result = await new FirestoreDoctorPresenceCore(db).trackPresence({
    roomName,
    action,
    doctorUserId,
    doctorName: body.doctorName?.trim() || null,
    doctorEmail: body.doctorEmail?.trim().toLowerCase() || null,
    consultationSessionId: body.consultationSessionId?.trim() || null,
  });
  return serviceResultToResponse(result);
}

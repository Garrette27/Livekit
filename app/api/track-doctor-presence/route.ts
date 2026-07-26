import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { serviceResultToResponse } from '@/lib/services/shared/http';
import { serviceError } from '@/lib/services/shared/service-result';
import { FirestoreDoctorPresenceCore } from '@/lib/services/doctor-presence';
import type { DoctorPresenceAction } from '@/lib/services/doctor-presence';
import { authorizeBearerRequest } from '@/lib/services/shared/request-auth';
import { DoctorRoomAccess } from '@/lib/services/room-access';

export const maxDuration = 60;

interface TrackDoctorPresenceRequest {
  roomName?: string;
  action?: DoctorPresenceAction;
  doctorUserId?: string;
  doctorName?: string | null;
  doctorEmail?: string | null;
  consultationSessionId?: string | null;
}

async function handlePOST(req: Request) {
  const auth = await authorizeBearerRequest(req, 'room:join-doctor');
  if (!auth.ok) {
    return serviceResultToResponse(auth);
  }

  const body = (await req.json()) as TrackDoctorPresenceRequest;
  const roomName = body.roomName?.trim();
  const action = body.action;
  const doctorUserId = auth.data.userId;

  if (!roomName || !action) {
    return serviceResultToResponse(
      serviceError(400, 'missing_fields', 'roomName and action are required')
    );
  }
  if (action !== 'join' && action !== 'leave') {
    return serviceResultToResponse(serviceError(400, 'unsupported_action', `Unsupported action: ${action}`));
  }

  const db = getFirebaseAdmin();
  if (!db) {
    return serviceResultToResponse(serviceError(500, 'db_unavailable', 'Firebase Admin not initialized'));
  }

  const roomAccess = await new DoctorRoomAccess(db).authorizeDoctorRoom({
    roomName,
    doctor: {
      userId: doctorUserId,
      email: auth.data.email,
      name: body.doctorName?.trim(),
    },
  });
  if (!roomAccess.ok) {
    return serviceResultToResponse(roomAccess);
  }

  const result = await new FirestoreDoctorPresenceCore(db).trackPresence({
    roomName,
    action,
    doctorUserId,
    doctorName: body.doctorName?.trim() || null,
    doctorEmail: auth.data.email?.trim().toLowerCase() || null,
    consultationSessionId: body.consultationSessionId?.trim() || null,
  });
  return serviceResultToResponse(result);
}

export const POST = withRequestLogging(handlePOST);

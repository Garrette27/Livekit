import type { Firestore } from 'firebase-admin/firestore';
import { verifyLiveKitRoomToken } from '@/lib/invitations/token-utils';
import { ConsultationSessionRepository } from '@/lib/repositories/consultation-session-repository';
import { serviceError, serviceOk, type ServiceResult } from './service-result';

export interface AuthorizedSessionParticipant {
  identity: string;
  participantName: string;
  participantType: 'doctor' | 'patient';
  roomName: string;
  joinedAt: Date;
}

/**
 * Binds a LiveKit participant credential to one persisted consultation. This
 * prevents callers from reading or writing chat by guessing a session id.
 */
export async function authorizeSessionParticipant(
  req: Request,
  db: Firestore,
  consultationSessionId: string
): Promise<ServiceResult<AuthorizedSessionParticipant>> {
  const authorization = req.headers.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return serviceError(401, 'missing_room_token', 'LiveKit room token is required');
  }

  let participant;
  try {
    participant = verifyLiveKitRoomToken(token);
  } catch {
    return serviceError(401, 'invalid_room_token', 'LiveKit room token is invalid or expired');
  }

  const sessionDoc = await new ConsultationSessionRepository(db).getById(consultationSessionId);
  if (!sessionDoc.exists) {
    return serviceError(404, 'consultation_not_found', 'Consultation session not found');
  }

  const sessionRoomName = sessionDoc.data()?.roomName;
  if (typeof sessionRoomName !== 'string' || sessionRoomName !== participant.roomName) {
    return serviceError(403, 'consultation_forbidden', 'Room token does not grant access to this consultation');
  }

  const participantType = participant.identity.startsWith('doctor_') ? 'doctor' : 'patient';
  return serviceOk({
    identity: participant.identity,
    participantName: participant.participantName || participant.identity,
    participantType,
    roomName: participant.roomName,
    joinedAt: new Date((participant.issuedAt || Math.floor(Date.now() / 1000)) * 1000),
  });
}

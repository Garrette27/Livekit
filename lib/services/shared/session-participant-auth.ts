import type { Firestore } from 'firebase-admin/firestore';
import { verifyLiveKitRoomToken } from '@/lib/invitations/token-utils';
import { ConsultationSessionRepository } from '@/lib/repositories/consultation-session-repository';
import { hasRecordedPatientIdentity } from '@/lib/consultations/identity-utils';
import { serviceError, serviceOk, type ServiceResult } from './service-result';

export interface AuthorizedSessionParticipant {
  identity: string;
  participantName: string;
  participantType: 'doctor' | 'patient';
  roomName: string;
  joinedAt: Date;
}

/**
 * Binds a room credential to its recorded encounter participant, not merely
 * the reusable room name. Guest tracking records the signed transport identity
 * as patientUserId; registered visits record the signed Firebase binding.
 * This is a principal check, not proof of a unique visit: current credentials
 * can outlive/recur across visits by that principal in a reusable room.
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

  const session = sessionDoc.data() as Record<string, unknown>;
  const sessionRoomName = session.roomName;
  if (typeof sessionRoomName !== 'string' || sessionRoomName !== participant.roomName) {
    return serviceError(403, 'consultation_forbidden', 'Room token does not grant access to this consultation');
  }

  const metadata = (session.metadata as Record<string, unknown> | undefined) || {};
  const doctorIds = [session.doctorUserId, metadata.createdBy].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );
  const isDoctor = doctorIds.length > 0
    && doctorIds.every((id) => participant.identity === `doctor_${id}`);
  const isPatient = participant.identity.startsWith('patient_')
    && hasRecordedPatientIdentity(session, participant.patientUserId || participant.identity);
  if (!isDoctor && !isPatient) {
    return serviceError(403, 'consultation_forbidden', 'Room token does not belong to this encounter participant');
  }
  const participantType = isDoctor ? 'doctor' : 'patient';
  return serviceOk({
    identity: participant.identity,
    participantName: participant.participantName || participant.identity,
    participantType,
    roomName: participant.roomName,
    joinedAt: new Date((participant.issuedAt || Math.floor(Date.now() / 1000)) * 1000),
  });
}

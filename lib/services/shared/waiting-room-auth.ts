import { verifyLiveKitRoomToken } from '@/lib/invitations/token-utils';

export interface WaitingRoomCredential {
  identity: string;
  roomName: string;
}

export interface WaitingRoomAuthorization {
  credential?: WaitingRoomCredential;
  error?: string;
  status: number;
}

/**
 * Verifies that a signed patient room credential names the invitation and/or
 * waiting entry being changed. Routes can therefore accept beacon-compatible
 * body credentials without trusting caller-provided document ids.
 */
export function authorizeWaitingRoomRequest(input: {
  accessToken?: string;
  invitationId?: string;
  waitingPatientId?: string;
}): WaitingRoomAuthorization {
  if (!input.accessToken) {
    return { status: 401, error: 'LiveKit room token is required' };
  }

  let participant;
  try {
    participant = verifyLiveKitRoomToken(input.accessToken);
  } catch {
    return { status: 401, error: 'LiveKit room token is invalid or expired' };
  }

  if (!participant.identity.startsWith('patient_')) {
    return { status: 403, error: 'A patient room token is required' };
  }

  if (
    input.invitationId
    && !participant.identity.startsWith(`patient_${input.invitationId}_`)
  ) {
    return { status: 403, error: 'Room token does not grant access to this invitation' };
  }

  if (
    input.waitingPatientId
    && !participant.identity.endsWith(`_${input.waitingPatientId}`)
  ) {
    return { status: 403, error: 'Room token does not grant access to this waiting entry' };
  }

  return {
    status: 200,
    credential: {
      identity: participant.identity,
      roomName: participant.roomName,
    },
  };
}

import jwt from 'jsonwebtoken';
import { InvitationToken } from '../types';

/**
 * Signing secret for invitation and LiveKit room tokens. Fails closed: a
 * missing LIVEKIT_API_SECRET must never silently downgrade to a guessable
 * secret, because anyone could then forge invite links for any room.
 */
export function getJwtSecret(): string {
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!secret) {
    throw new Error('LIVEKIT_API_SECRET is not configured; refusing to sign or verify tokens');
  }
  return secret;
}

export function getLiveKitIssuer(): string | undefined {
  return process.env.LIVEKIT_API_KEY;
}

export function signInvitationToken(payload: InvitationToken): string {
  return jwt.sign(payload, getJwtSecret(), { algorithm: 'HS256' });
}

export function verifyInvitationToken(token: string): InvitationToken {
  return jwt.verify(token, getJwtSecret()) as InvitationToken;
}

export interface VerifiedLiveKitRoomToken {
  identity: string;
  participantName?: string;
  roomName: string;
  issuedAt?: number;
}

/**
 * Verifies the same signed room credential used by LiveKit and exposes only
 * the participant fields needed by first-party room APIs.
 */
export function verifyLiveKitRoomToken(token: string): VerifiedLiveKitRoomToken {
  const issuer = getLiveKitIssuer();
  const payload = jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
    ...(issuer ? { issuer } : {}),
  }) as jwt.JwtPayload & {
    name?: string;
    video?: { roomJoin?: boolean; room?: string };
  };

  if (
    typeof payload.sub !== 'string'
    || !payload.sub.trim()
    || payload.video?.roomJoin !== true
    || typeof payload.video.room !== 'string'
    || !payload.video.room.trim()
  ) {
    throw new Error('Invalid LiveKit room token');
  }

  return {
    identity: payload.sub,
    participantName: typeof payload.name === 'string' ? payload.name : undefined,
    roomName: payload.video.room,
    issuedAt: payload.iat,
  };
}

interface LiveKitTokenOptions {
  subject: string;
  roomName: string;
  participantName?: string;
  expiresIn?: jwt.SignOptions['expiresIn'];
}

export function signLiveKitRoomToken({
  subject,
  roomName,
  participantName,
  expiresIn = '1h',
}: LiveKitTokenOptions): string {
  const payload: Record<string, unknown> = {
    sub: subject,
    video: {
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
    audio: {
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    },
  };

  if (participantName) {
    payload.name = participantName;
  }

  return jwt.sign(
    payload,
    getJwtSecret(),
    {
      issuer: getLiveKitIssuer(),
      expiresIn,
      algorithm: 'HS256',
    }
  );
}

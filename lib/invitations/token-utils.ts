import jwt from 'jsonwebtoken';
import { InvitationToken } from '../types';

const FALLBACK_SECRET = 'fallback-secret';

export function getJwtSecret(): string {
  return process.env.LIVEKIT_API_SECRET || FALLBACK_SECRET;
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

import { RoomServiceClient } from 'livekit-server-sdk';
import { signLiveKitRoomToken } from '@/lib/invitations/token-utils';
import type { IssueRtcRoomTokenInput, RtcTransportAdapter } from './contracts';

function resolveLiveKitHttpHost(): string | null {
  const rawUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim();
  if (!rawUrl) {
    return null;
  }

  return rawUrl.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
}

function shouldIgnoreDisconnectError(error: unknown): boolean {
  const message = (error as { message?: string })?.message || String(error);
  return message.toLowerCase().includes('not found');
}

export class LiveKitRtcTransportAdapter implements RtcTransportAdapter {
  issueRoomToken(input: IssueRtcRoomTokenInput): string {
    return signLiveKitRoomToken(input);
  }

  async isParticipantConnected(input: { roomName: string; participantIdentity: string }): Promise<boolean> {
    const host = resolveLiveKitHttpHost();
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!host || !apiKey || !apiSecret) {
      return false;
    }
    try {
      await new RoomServiceClient(host, apiKey, apiSecret).getParticipant(input.roomName, input.participantIdentity);
      return true;
    } catch {
      // Not found (or the room is gone) means not connected.
      return false;
    }
  }

  async disconnectParticipant(input: { roomName: string; participantIdentity: string }): Promise<void> {
    const host = resolveLiveKitHttpHost();
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!host || !apiKey || !apiSecret) {
      return;
    }

    const roomService = new RoomServiceClient(host, apiKey, apiSecret);
    try {
      await roomService.removeParticipant(input.roomName, input.participantIdentity);
    } catch (error) {
      if (shouldIgnoreDisconnectError(error)) {
        return;
      }

      console.warn('RTC transport disconnect failed', {
        roomName: input.roomName,
        participantIdentity: input.participantIdentity,
        error: (error as { message?: string })?.message || String(error),
      });
    }
  }
}

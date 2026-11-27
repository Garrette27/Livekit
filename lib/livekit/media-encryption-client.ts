'use client';

import { ExternalE2EEKeyProvider, Room, isE2EESupported, type RoomOptions } from 'livekit-client';

/**
 * Builds the LiveKit Room a consultation joins, end-to-end encrypted when the
 * deployment has a media key secret (see lib/livekit/media-encryption.ts).
 *
 * The caller hands over its consultation credential; this module fetches the
 * room key, starts LiveKit's E2EE worker, and returns a Room whose audio,
 * video and data messages are encrypted in the browser before upload. It never
 * silently downgrades: if the server says E2EE is on but this browser cannot
 * do it, the result is `unsupported`, because a plaintext participant could
 * neither see nor be seen by encrypted ones and the "end-to-end" claim would
 * be false. When the server says E2EE is off, every participant gets a plain
 * Room (transport encryption only), so a room never mixes modes.
 */
export type ConsultationRoomPreparation =
  | { kind: 'ready'; room: Room; encryption: 'end-to-end' | 'transport' }
  | { kind: 'unsupported' }
  | { kind: 'failed'; message: string };

export async function prepareConsultationRoom(
  accessToken: string,
  options: RoomOptions,
  signal?: AbortSignal
): Promise<ConsultationRoomPreparation> {
  let response: Response;
  try {
    response = await fetch('/api/livekit/media-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
      cache: 'no-store',
      signal,
    });
  } catch {
    return { kind: 'failed', message: 'Could not reach the server to secure this call. Check your connection and retry.' };
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.success) {
    return { kind: 'failed', message: result?.error || 'Could not secure this call. Please retry.' };
  }
  if (result.enabled !== true) {
    return { kind: 'ready', room: new Room(options), encryption: 'transport' };
  }
  if (typeof result.key !== 'string' || !result.key || !isE2EESupported()) {
    return { kind: 'unsupported' };
  }

  const keyProvider = new ExternalE2EEKeyProvider();
  const worker = new Worker(new URL('livekit-client/e2ee-worker', import.meta.url));
  const room = new Room({ ...options, encryption: { keyProvider, worker } });
  try {
    await keyProvider.setKey(result.key);
    await room.setE2EEEnabled(true);
  } catch {
    worker.terminate();
    return { kind: 'unsupported' };
  }
  return { kind: 'ready', room, encryption: 'end-to-end' };
}

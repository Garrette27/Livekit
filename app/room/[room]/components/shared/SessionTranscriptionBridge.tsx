'use client';

import React from 'react';
import { useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';

const CHUNK_DURATION_MS = 10_000;
const AUDIO_BITS_PER_SECOND = 32_000;

function createCaptureId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function selectRecorderMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }

  return [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ].find((candidate) => MediaRecorder.isTypeSupported(candidate)) || null;
}

/**
 * Converts only the local participant's already-published LiveKit microphone
 * track into short standalone files. Channel separation supplies trustworthy
 * speaker identity; the server discards audio after transcription. Capture
 * failure never interrupts the call because the legacy text path remains the
 * bounded fallback.
 */
export default function SessionTranscriptionBridge({
  consultationSessionId,
  accessToken,
}: {
  consultationSessionId?: string | null;
  accessToken: string;
}) {
  const microphoneTracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });
  const localMicrophone = microphoneTracks.find((reference) => reference.participant.isLocal);
  const mediaStreamTrack = localMicrophone?.publication.track?.mediaStreamTrack || null;
  const isMuted = localMicrophone?.publication.isMuted !== false;
  const captureIdRef = React.useRef(createCaptureId());
  const sequenceRef = React.useRef(0);
  const uploadUnavailableRef = React.useRef(false);

  React.useEffect(() => {
    const normalizedSessionId = consultationSessionId?.trim() || '';
    const mimeType = selectRecorderMimeType();
    if (
      !normalizedSessionId
      || !mediaStreamTrack
      || mediaStreamTrack.readyState !== 'live'
      || isMuted
      || !mimeType
      || uploadUnavailableRef.current
    ) {
      return;
    }

    let disposed = false;
    let recorder: MediaRecorder | null = null;
    let stopTimer: number | null = null;
    let chunkStartedAtMs = Date.now();

    const uploadChunk = (audio: Blob, durationMs: number) => {
      if (audio.size === 0 || uploadUnavailableRef.current) {
        return;
      }

      const sequence = sequenceRef.current++;
      const form = new FormData();
      form.set('consultationSessionId', normalizedSessionId);
      form.set('captureId', captureIdRef.current);
      form.set('sequence', String(sequence));
      form.set('durationMs', String(Math.max(250, Math.min(durationMs, CHUNK_DURATION_MS + 1_000))));
      form.set('audio', audio, `microphone-${sequence}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`);

      void fetch('/api/session-transcription/chunks', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
        keepalive: true,
      })
        .then((response) => {
          if ([401, 403, 404, 503].includes(response.status)) {
            uploadUnavailableRef.current = true;
            disposed = true;
            if (stopTimer !== null) {
              window.clearTimeout(stopTimer);
            }
            if (recorder?.state === 'recording') {
              recorder.stop();
            }
          }
          if (!response.ok && response.status !== 503) {
            console.warn('A consultation transcript audio chunk could not be processed:', response.status);
          }
        })
        .catch(() => {
          // The call must remain usable even when transcription is unavailable.
        });
    };

    const startChunk = () => {
      if (disposed || mediaStreamTrack.readyState !== 'live') {
        return;
      }

      const recordedParts: BlobPart[] = [];
      chunkStartedAtMs = Date.now();
      try {
        recorder = new MediaRecorder(new MediaStream([mediaStreamTrack]), {
          mimeType,
          audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        });
      } catch (error) {
        console.warn('Session transcript capture could not start:', error);
        return;
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedParts.push(event.data);
        }
      };
      recorder.onstop = () => {
        const stoppedAtMs = Date.now();
        const audio = new Blob(recordedParts, { type: mimeType });
        uploadChunk(audio, stoppedAtMs - chunkStartedAtMs);
        recorder = null;
        if (!disposed) {
          startChunk();
        }
      };
      recorder.onerror = () => {
        console.warn('Session transcript capture encountered a recorder error.');
      };
      recorder.start();
      stopTimer = window.setTimeout(() => {
        if (recorder?.state === 'recording') {
          recorder.stop();
        }
      }, CHUNK_DURATION_MS);
    };

    startChunk();

    return () => {
      disposed = true;
      if (stopTimer !== null) {
        window.clearTimeout(stopTimer);
      }
      if (recorder?.state === 'recording') {
        recorder.stop();
      }
    };
  }, [accessToken, consultationSessionId, isMuted, mediaStreamTrack]);

  return null;
}

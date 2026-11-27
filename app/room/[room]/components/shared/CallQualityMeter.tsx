'use client';

import React, { useEffect, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { summarizeCallStats, type CallQualitySample } from '@/lib/livekit/call-quality';

const SAMPLE_INTERVAL_MS = 3000;

/**
 * Collapsed "Call quality" readout inside the room. Every few seconds it reads
 * WebRTC statistics from this browser's LiveKit tracks and shows the measured
 * round-trip time, jitter, packet loss and received/sent video size. "Copy
 * measurement" puts an identity-free JSON sample on the clipboard so a
 * paired-call trial can record real numbers. It only observes; it never
 * changes media settings, and the call works the same if it fails.
 *
 * It also states how the media is protected: "End-to-end" only while this
 * browser is actually encrypting (room.isE2EEEnabled), and it surfaces a
 * decryption failure instead of leaving a silent black tile.
 */
export default function CallQualityMeter({ encryption }: { encryption: 'end-to-end' | 'transport' }) {
  const room = useRoomContext();
  const [sample, setSample] = useState<CallQualitySample | null>(null);
  const [copied, setCopied] = useState(false);
  const [encrypting, setEncrypting] = useState(room.isE2EEEnabled);
  const [decryptProblem, setDecryptProblem] = useState(false);

  useEffect(() => {
    const onStatus = () => setEncrypting(room.isE2EEEnabled);
    const onError = () => setDecryptProblem(true);
    room.on(RoomEvent.ParticipantEncryptionStatusChanged, onStatus);
    room.on(RoomEvent.EncryptionError, onError);
    onStatus();
    return () => {
      room.off(RoomEvent.ParticipantEncryptionStatusChanged, onStatus);
      room.off(RoomEvent.EncryptionError, onError);
    };
  }, [room]);

  const protection = encryption === 'end-to-end'
    ? encrypting ? 'End-to-end (AES-GCM) + DTLS-SRTP' : 'Starting end-to-end encryption…'
    : 'In transit (DTLS-SRTP / TLS)';

  useEffect(() => {
    let cancelled = false;
    const collect = async () => {
      const tracks = [
        ...Array.from(room.localParticipant.trackPublications.values()),
        ...Array.from(room.remoteParticipants.values()).flatMap((participant) => Array.from(participant.trackPublications.values())),
      ]
        .map((publication) => publication.track)
        .filter((track): track is NonNullable<typeof track> => Boolean(track));
      const entries: Record<string, unknown>[] = [];
      await Promise.all(
        tracks.map(async (track) => {
          try {
            const report = await track.getRTCStatsReport();
            report?.forEach((entry) => entries.push(entry as Record<string, unknown>));
          } catch {
            // A track that is ending has no stats; skip it this round.
          }
        })
      );
      if (!cancelled) setSample(summarizeCallStats(entries));
    };
    void collect();
    const timer = window.setInterval(() => void collect(), SAMPLE_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [room]);

  const show = (value: number | null, unit: string) => (value === null ? 'not measured' : `${value} ${unit}`);
  const video = (v: CallQualitySample['receivedVideo']) =>
    v ? `${v.width}×${v.height}${v.fps === null ? '' : ` @ ${v.fps} fps`}` : 'not measured';

  const copy = async () => {
    if (!sample) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({
          measuredAtUtc: new Date().toISOString(),
          remoteParticipants: room.remoteParticipants.size,
          mediaEncryption: encryption === 'end-to-end' && encrypting ? 'end-to-end' : 'transport',
          ...sample,
        })
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <details
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 10020,
        background: 'rgba(15, 23, 42, 0.88)',
        color: '#e2e8f0',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 10,
        padding: '0.35rem 0.6rem',
        fontSize: '0.75rem',
        maxWidth: 'min(18rem, calc(100% - 24px))',
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        Call quality{encryption === 'end-to-end' && encrypting ? ' · End-to-end encrypted' : ''}
      </summary>
      <dl style={{ margin: '0.4rem 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.2rem 0.6rem' }}>
        <dt>Round trip</dt><dd style={{ margin: 0 }}>{show(sample?.roundTripMs ?? null, 'ms')}</dd>
        <dt>Jitter</dt><dd style={{ margin: 0 }}>{show(sample?.jitterMs ?? null, 'ms')}</dd>
        <dt>Packet loss</dt><dd style={{ margin: 0 }}>{show(sample?.packetLossPercent ?? null, '% since join')}</dd>
        <dt>Receiving</dt><dd style={{ margin: 0 }}>{video(sample?.receivedVideo ?? null)}</dd>
        <dt>Sending</dt><dd style={{ margin: 0 }}>{video(sample?.sentVideo ?? null)}</dd>
        <dt>Protection</dt><dd style={{ margin: 0 }}>{protection}</dd>
      </dl>
      <button
        type="button"
        onClick={copy}
        disabled={!sample}
        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 6, border: '1px solid #475569', background: '#1e293b', color: '#e2e8f0', cursor: 'pointer' }}
      >
        {copied ? 'Copied' : 'Copy measurement'}
      </button>
      {decryptProblem ? (
        <p role="alert" style={{ margin: '0.4rem 0 0', color: '#fca5a5' }}>
          Media from a participant could not be decrypted. Ask them to leave and rejoin.
        </p>
      ) : null}
      <span role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {copied ? 'Measurement copied' : ''}
      </span>
    </details>
  );
}

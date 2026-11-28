'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { MediaDeviceFailure, RoomEvent, Track, type LocalVideoTrack, type Room, type TrackPublication } from 'livekit-client';
import { ROOM_LAYERS } from '@/lib/ui/room-layers';
import { redactId, videoStatDeltas, type VideoStatDelta } from '@/lib/livekit/media-diagnostics';

/**
 * TEMPORARY media diagnostics for the video-flicker investigation (28 Nov 2026).
 * Rendered only when the page URL has `?mediaDiagnostics=1`; remove once the
 * investigation in docs/livekit-video-stability.md is closed.
 *
 * Each second it records, per video track: local/remote, redacted participant
 * and track ids, source, subscription/mute/stream state, local capture
 * settings, and WebRTC stat deltas. It also timestamps room, track,
 * page-visibility and <video> element lifecycle events (attach/detach,
 * added/removed from the DOM, emptied/stalled/waiting/resize). "Copy
 * diagnostics" exports JSON with no tokens, names, emails, room names or media.
 * It observes only; it never changes media, consent or admission.
 */

interface TrackRow extends Partial<VideoStatDelta> {
  who: string;
  track: string;
  source: string;
  subscribed: boolean | null;
  muted: boolean;
  streamState: string | null;
  attachedElements: number;
  capture: string | null;
}
interface Sample { t: number; visibility: string; rows: TrackRow[] }
interface LogEntry { t: number; event: string; detail?: string }

const MAX_SAMPLES = 180;
const MAX_EVENTS = 400;

export function mediaDiagnosticsRequested(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('mediaDiagnostics') === '1';
}

function participantLabel(room: Room, identity: string): string {
  return identity === room.localParticipant.identity ? 'local' : `remote ${redactId(identity)}`;
}

export default function MediaDiagnosticsPanel() {
  const room = useRoomContext();
  const startedAt = useRef(performance.now());
  const samples = useRef<Sample[]>([]);
  const events = useRef<LogEntry[]>([]);
  const [latest, setLatest] = useState<Sample | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const at = () => Math.round(performance.now() - startedAt.current);
    const log = (event: string, detail?: string) => {
      events.current.push({ t: at(), event, detail });
      if (events.current.length > MAX_EVENTS) events.current.shift();
      setEventCount(events.current.length);
    };
    log('diagnostics-start', `visibility=${document.visibilityState}`);

    const roomEvents: RoomEvent[] = [
      RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted,
      RoomEvent.TrackStreamStateChanged, RoomEvent.TrackSubscriptionStatusChanged, RoomEvent.TrackSubscriptionFailed,
      RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.ActiveDeviceChanged,
      RoomEvent.Reconnecting, RoomEvent.Reconnected, RoomEvent.SignalReconnecting, RoomEvent.ConnectionStateChanged,
      RoomEvent.EncryptionError, RoomEvent.ParticipantEncryptionStatusChanged, RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
    ];
    const handlers = roomEvents.map((name) => {
      const handler = (...args: unknown[]) => {
        const parts: string[] = [];
        for (const arg of args) {
          if (typeof arg === 'string') parts.push(name === RoomEvent.ActiveDeviceChanged ? redactId(arg) : arg);
          else if (arg && typeof arg === 'object') {
            const value = arg as { trackSid?: string; sid?: string; source?: string; identity?: string; name?: string };
            if (value.trackSid || value.sid) parts.push(`track ${redactId(value.trackSid || value.sid)}${value.source ? ` ${value.source}` : ''}`);
            else if (value.identity) parts.push(participantLabel(room, value.identity));
            else if (value.name) parts.push(value.name);
          }
        }
        log(name, parts.join(' · '));
      };
      room.on(name, handler);
      return [name, handler] as const;
    });
    const onMediaError = (error: Error, kind?: MediaDeviceKind) =>
      log(RoomEvent.MediaDevicesError, `${kind ?? 'unknown-kind'} · ${MediaDeviceFailure.getFailure(error) ?? 'unknown'} · ${error?.name ?? ''}`);
    room.on(RoomEvent.MediaDevicesError, onMediaError);

    const onVisibility = () => log('page-visibility', document.visibilityState);
    document.addEventListener('visibilitychange', onVisibility);
    const mediaEvents = ['emptied', 'stalled', 'waiting', 'resize', 'loadedmetadata', 'pause', 'suspend'];
    const onMediaElement = (event: Event) => {
      const element = event.target as HTMLVideoElement;
      if (element?.tagName !== 'VIDEO') return;
      log(`video:${event.type}`, `${element.videoWidth}x${element.videoHeight}`);
    };
    mediaEvents.forEach((name) => document.addEventListener(name, onMediaElement, true));
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const count = (nodes: NodeList) => Array.from(nodes).reduce((total, node) =>
          total + (node instanceof HTMLVideoElement ? 1 : node instanceof Element ? node.querySelectorAll('video').length : 0), 0);
        const added = count(mutation.addedNodes);
        const removed = count(mutation.removedNodes);
        if (added) log('video-element-added', String(added));
        if (removed) log('video-element-removed', String(removed));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    let previous = new Map<string, Record<string, unknown>>();
    let cancelled = false;
    const timer = window.setInterval(async () => {
      const rows: TrackRow[] = [];
      const participants = [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
      const entriesByTrack: Array<{ base: TrackRow; entries: Record<string, unknown>[] }> = [];
      for (const participant of participants) {
        const publications: TrackPublication[] = [...(participant.trackPublications as Map<string, TrackPublication>).values()];
        for (const publication of publications) {
          if (publication.kind !== Track.Kind.Video) continue;
          const track = publication.track;
          const isLocal = participant === room.localParticipant;
          let capture: string | null = null;
          if (isLocal && track) {
            const settings = (track as LocalVideoTrack).mediaStreamTrack?.getSettings?.() ?? {};
            capture = `${settings.width ?? '?'}x${settings.height ?? '?'}@${settings.frameRate ? Math.round(settings.frameRate) : '?'} device ${redactId(settings.deviceId)} ${(track as LocalVideoTrack).mediaStreamTrack?.readyState ?? ''}`;
          }
          const base: TrackRow = {
            who: participantLabel(room, participant.identity),
            track: redactId(publication.trackSid),
            source: publication.source,
            subscribed: isLocal ? null : publication.isSubscribed,
            muted: publication.isMuted,
            streamState: track && 'streamState' in track ? String((track as { streamState: string }).streamState) : null,
            attachedElements: track?.attachedElements.length ?? 0,
            capture,
          };
          const entries: Record<string, unknown>[] = [];
          if (track) {
            try {
              const report = await track.getRTCStatsReport();
              report?.forEach((entry) => entries.push(entry as Record<string, unknown>));
            } catch { /* ending track */ }
          }
          entriesByTrack.push({ base, entries });
        }
      }
      if (cancelled) return;
      const next = new Map<string, Record<string, unknown>>();
      for (const { base, entries } of entriesByTrack) {
        const { deltas, next: trackNext } = videoStatDeltas(previous, entries);
        trackNext.forEach((value, key) => next.set(key, value));
        if (!deltas.length) rows.push(base);
        for (const delta of deltas) rows.push({ ...base, ...delta });
      }
      previous = next;
      const sample = { t: at(), visibility: document.visibilityState, rows };
      samples.current.push(sample);
      if (samples.current.length > MAX_SAMPLES) samples.current.shift();
      setLatest(sample);
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      handlers.forEach(([name, handler]) => room.off(name, handler));
      room.off(RoomEvent.MediaDevicesError, onMediaError);
      document.removeEventListener('visibilitychange', onVisibility);
      mediaEvents.forEach((name) => document.removeEventListener(name, onMediaElement, true));
      observer.disconnect();
    };
  }, [room]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({
        kind: 'teleconsole-media-diagnostics-v1',
        capturedAtUtc: new Date().toISOString(),
        note: 'Times are ms since diagnostics start. Per-second rows are deltas; the first row per track is a baseline.',
        events: events.current,
        samples: samples.current,
      }));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  };

  const cell = (value: unknown) => (value === null || value === undefined ? '—' : String(value));
  return (
    <section
      aria-label="Media diagnostics"
      style={{ position: 'absolute', right: 12, top: 52, zIndex: ROOM_LAYERS.diagnostics, width: 'min(34rem, calc(100% - 24px))', maxHeight: '60%', overflow: 'auto',
        background: 'rgba(2,6,23,0.92)', color: '#e2e8f0', font: '11px/1.4 ui-monospace, monospace', border: '1px solid #f59e0b', borderRadius: 8, padding: 8 }}
    >
      <strong style={{ color: '#fbbf24' }}>Media diagnostics (temporary)</strong>{' '}
      <span>t={latest ? `${(latest.t / 1000).toFixed(0)}s` : '…'} · {latest?.visibility} · events {eventCount}</span>{' '}
      <button type="button" onClick={copy} style={{ font: 'inherit', marginLeft: 6 }}>{copied ? 'Copied' : 'Copy diagnostics'}</button>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
        <thead><tr>{['who', 'track', 'dir/rid', 'res@fps', 'dec', 'enc', 'drop', 'frz', 'key', 'kreq', 'state', 'el', 'limit'].map((h) => <th key={h} style={{ textAlign: 'left', paddingRight: 6 }}>{h}</th>)}</tr></thead>
        <tbody>
          {latest?.rows.map((row, index) => (
            <tr key={index}>
              <td>{row.who}</td><td>{row.track} {row.source}</td><td>{cell(row.direction)}{row.rid ? `/${row.rid}` : ''}</td>
              <td>{row.width ? `${row.width}x${row.height}@${cell(row.fps)}` : '—'}</td>
              <td>{cell(row.decoded)}</td><td>{cell(row.encoded)}</td><td>{cell(row.dropped)}</td><td>{cell(row.freezes)}</td>
              <td>{cell(row.keyframes)}</td><td>{cell(row.keyframeRequests)}</td>
              <td>{row.muted ? 'muted ' : ''}{row.subscribed === false ? 'unsub ' : ''}{cell(row.streamState)}</td>
              <td>{row.attachedElements}</td><td>{cell(row.limitedBy)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {latest?.rows.filter((row) => row.capture).map((row, index) => <div key={index}>capture: {row.capture}</div>)}
      <div style={{ marginTop: 6, color: '#94a3b8' }}>
        {events.current.slice(-8).map((entry, index) => <div key={index}>{(entry.t / 1000).toFixed(1)}s {entry.event} {entry.detail}</div>)}
      </div>
    </section>
  );
}

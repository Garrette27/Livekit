'use client';

import React, { useEffect, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { MediaDeviceFailure, RoomEvent, Track, type LocalTrackPublication } from 'livekit-client';
import { ROOM_LAYERS } from '@/lib/ui/room-layers';
import { describeDeviceProblems, deviceForKind, type DeviceProblem, type DeviceProblems } from '@/lib/livekit/device-problems';
import { DeviceSwitchError } from '@/lib/livekit/recoverable-device-switch';

/**
 * In-call notice for a camera or microphone this browser could not use.
 *
 * Sources of truth, in order: the Permissions API (`denied` means the site is
 * blocked), and LiveKit's `MediaDevicesError(error, kind)` classified with
 * `MediaDeviceFailure` (permission denied, device in use, not found). Only the
 * device named by `kind` is reported. A problem clears as soon as that device
 * publishes a track again, so a working camera never sits under a stale
 * "blocked" warning. A device picked from the menu that would not start is
 * reported as such after lib/livekit/recoverable-device-switch.ts restores
 * the previous one. It never requests permission and never blocks the call.
 */
export default function DevicePermissionNotice() {
  const room = useRoomContext();
  const [problems, setProblems] = useState<DeviceProblems>({});
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const statuses: PermissionStatus[] = [];
    const set = (device: 'camera' | 'microphone', problem: DeviceProblem | null) => {
      if (cancelled) return;
      setProblems((current) => {
        if ((current[device] ?? null) === problem) return current;
        const next = { ...current };
        if (problem) next[device] = problem; else delete next[device];
        return next;
      });
      if (problem) setDismissed(false);
    };

    const watch = async (device: 'camera' | 'microphone') => {
      try {
        const status = await navigator.permissions.query({ name: device as PermissionName });
        statuses.push(status);
        const apply = () => {
          if (status.state === 'denied') set(device, 'blocked');
          else setProblems((current) => {
            if (current[device] !== 'blocked') return current;
            const next = { ...current };
            delete next[device];
            return next;
          });
        };
        apply();
        status.onchange = apply;
      } catch {
        // Unsupported permission name; MediaDevicesError still reports failures.
      }
    };
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      void watch('camera');
      void watch('microphone');
    }

    const onMediaError = (reported: Error, kind?: MediaDeviceKind) => {
      const device = deviceForKind(kind);
      // A failed pick from the device menu: the previous device was restored.
      if (device && reported instanceof DeviceSwitchError && reported.restored) {
        set(device, 'switch-failed');
        return;
      }
      const error = reported instanceof DeviceSwitchError ? reported.cause as Error : reported;
      const failure = MediaDeviceFailure.getFailure(error);
      if (!device || !failure) return;
      set(device, failure === MediaDeviceFailure.PermissionDenied ? 'blocked'
        : failure === MediaDeviceFailure.DeviceInUse ? 'in-use'
          : failure === MediaDeviceFailure.NotFound ? 'not-found' : 'failed');
    };
    const onPublished = (publication: LocalTrackPublication) => {
      if (publication.source === Track.Source.Camera) set('camera', null);
      if (publication.source === Track.Source.Microphone) set('microphone', null);
    };
    // A later successful pick replaces the "would not start" note.
    const onDeviceChanged = (kind: MediaDeviceKind) => {
      const device = deviceForKind(kind);
      if (!device) return;
      setProblems((current) => {
        if (current[device] !== 'switch-failed') return current;
        const next = { ...current };
        delete next[device];
        return next;
      });
    };
    room.on(RoomEvent.MediaDevicesError, onMediaError);
    room.on(RoomEvent.LocalTrackPublished, onPublished);
    room.on(RoomEvent.ActiveDeviceChanged, onDeviceChanged);

    return () => {
      cancelled = true;
      statuses.forEach((status) => { status.onchange = null; });
      room.off(RoomEvent.MediaDevicesError, onMediaError);
      room.off(RoomEvent.LocalTrackPublished, onPublished);
      room.off(RoomEvent.ActiveDeviceChanged, onDeviceChanged);
    };
  }, [room]);

  const message = describeDeviceProblems(problems);
  if (!message || dismissed) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'absolute',
        top: '3.25rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: ROOM_LAYERS.notice,
        width: 'min(32rem, calc(100% - 2rem))',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        border: '1px solid #f59e0b',
        background: '#fffbeb',
        color: '#78350f',
        fontSize: '0.875rem',
        lineHeight: 1.45,
        boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
      }}
    >
      {message}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss device notice"
        style={{ marginLeft: '0.5rem', border: 'none', background: 'transparent', color: '#78350f', fontWeight: 700, cursor: 'pointer' }}
      >
        ×
      </button>
    </div>
  );
}

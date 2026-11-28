'use client';

import React, { useEffect, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

type BlockedDevice = 'camera' | 'microphone';

/**
 * In-call notice shown when this browser has blocked camera or microphone
 * access for the site.
 *
 * LiveKit's device menus (the arrows beside Microphone and Camera) list
 * devices only after the browser grants media permission; when the site is
 * blocked the menu opens empty with no explanation. This notice names the
 * blocked device and tells the user how to re-allow it. It reads the browser
 * Permissions API where available and also listens for LiveKit's
 * MediaDevicesError, so browsers without the API still get the message after
 * a failed camera/microphone start. It never requests permission itself and
 * never blocks the call: the participant can still hear, see and chat.
 */
export default function DevicePermissionNotice() {
  const room = useRoomContext();
  const [blocked, setBlocked] = useState<Set<BlockedDevice>>(new Set());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const statuses: PermissionStatus[] = [];
    const update = (device: BlockedDevice, state: PermissionState) => {
      if (cancelled) return;
      setBlocked((current) => {
        const next = new Set(current);
        if (state === 'denied') next.add(device);
        else next.delete(device);
        return next;
      });
      if (state === 'denied') setDismissed(false);
    };

    const watch = async (device: BlockedDevice) => {
      try {
        const status = await navigator.permissions.query({ name: device as PermissionName });
        statuses.push(status);
        update(device, status.state);
        status.onchange = () => update(device, status.state);
      } catch {
        // Permissions API or this permission name is unsupported; the
        // MediaDevicesError listener below still covers a failed start.
      }
    };
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      void watch('camera');
      void watch('microphone');
    }

    const onMediaError = (error: Error) => {
      if (error?.name !== 'NotAllowedError') return;
      setBlocked((current) => (current.size > 0 ? current : new Set<BlockedDevice>(['camera', 'microphone'])));
      setDismissed(false);
    };
    room.on(RoomEvent.MediaDevicesError, onMediaError);

    return () => {
      cancelled = true;
      statuses.forEach((status) => { status.onchange = null; });
      room.off(RoomEvent.MediaDevicesError, onMediaError);
    };
  }, [room]);

  if (blocked.size === 0 || dismissed) return null;
  const devices = Array.from(blocked).sort().join(' and ');

  return (
    <div
      role="alert"
      style={{
        position: 'absolute',
        top: '3.25rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10060,
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
      <strong>This browser has blocked the {devices} for this site.</strong>{' '}
      The device lists stay empty until access is allowed. Click the site icon left of the
      address bar, set Camera and Microphone to <em>Allow</em>, then reload this page. You can
      still hear, see and chat with the other participant meanwhile.
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss device permission notice"
        style={{ marginLeft: '0.5rem', border: 'none', background: 'transparent', color: '#78350f', fontWeight: 700, cursor: 'pointer' }}
      >
        ×
      </button>
    </div>
  );
}

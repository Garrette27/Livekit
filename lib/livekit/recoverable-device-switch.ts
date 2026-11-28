'use client';

import { RoomEvent, type Room } from 'livekit-client';

/**
 * Raised (as a RoomEvent.MediaDevicesError) when the user picked a camera or
 * microphone that would not start. `restored` says whether the device that was
 * working before is live again; `cause` is the browser's original error.
 */
export class DeviceSwitchError extends Error {
  constructor(readonly cause: unknown, readonly restored: boolean) {
    super('The selected device could not be started');
    this.name = 'DeviceSwitchError';
  }
}

/**
 * Makes a failed device switch recoverable and visible.
 *
 * LiveKit stops the current camera before opening the new one. When the new
 * one cannot start (a virtual camera such as OBS that is not running, a device
 * held by another app), Room.switchActiveDevice throws, the device menu keeps
 * highlighting the old device, and the call is left with no camera and no
 * message. This decorator restores the previously working device and reports
 * the failure through the room's own MediaDevicesError event, which the
 * in-call device notice already listens to. Callers still see the rejection.
 */
export function makeDeviceSwitchRecoverable(room: Room): void {
  const switchDevice = room.switchActiveDevice.bind(room);
  room.switchActiveDevice = async (kind, deviceId, exact) => {
    const previous = room.getActiveDevice(kind);
    try {
      return await switchDevice(kind, deviceId, exact);
    } catch (error) {
      let restored = false;
      if (previous && previous !== deviceId && kind !== 'audiooutput') {
        try {
          restored = await switchDevice(kind, previous, exact);
        } catch {
          restored = false;
        }
      }
      room.emit(RoomEvent.MediaDevicesError, new DeviceSwitchError(error, restored), kind);
      throw error;
    }
  };
}

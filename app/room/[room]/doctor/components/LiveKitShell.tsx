'use client';

import React from 'react';
import RoomShell from '../../components/shared/RoomShell';
import { DOCTOR_ROOM_CONTROLS } from '../../components/shared/room-controls-policy';
import { DOCTOR_ROOM_CHAT } from '../../components/shared/room-chat-policy';

interface LiveKitShellProps {
  token: string;
  onDisconnected: () => void;
  onError: (error: Error) => void;
}

export default function LiveKitShell({ token, onDisconnected, onError }: LiveKitShellProps) {
  return (
    <RoomShell
      token={token}
      onDisconnected={() => onDisconnected()}
      onError={(error) => {
        const isCameraPermissionError =
          error.message?.includes('NotReadableError') ||
          error.message?.includes('video source') ||
          error.message?.includes('Could not start video source') ||
          error.name === 'NotReadableError';

        if (isCameraPermissionError) {
          console.error('Camera/video track error in doctor room:', {
            error: error.message || error,
            name: error.name,
            stack: error.stack,
            suggestion: 'Check browser permissions and ensure camera is not in use by another application',
          });
          return;
        }

        console.error('LiveKit error in doctor room:', error);
        onError(error);
      }}
      controlBarColor="blue"
      controlsPolicy={DOCTOR_ROOM_CONTROLS}
      chatPolicy={DOCTOR_ROOM_CHAT}
    />
  );
}

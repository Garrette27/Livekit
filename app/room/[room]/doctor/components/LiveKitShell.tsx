'use client';

import React from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';

interface LiveKitShellProps {
  token: string;
  roomName: string;
  onDisconnected: () => void;
  onError: (error: Error) => void;
}

export default function LiveKitShell({ token, roomName, onDisconnected, onError }: LiveKitShellProps) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://video-icebzbvf.livekit.cloud'}
      connect={true}
      // Removed audio and video props - let VideoConference handle permissions
      // when user clicks the camera/mic buttons. This prevents auto-enable errors.
      style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}
      onDisconnected={onDisconnected}
      onError={(error) => {
        // Filter out camera permission errors - these are expected when
        // camera/mic aren't auto-enabled. User can enable them via controls.
        const isCameraPermissionError = 
          error.message?.includes('NotReadableError') || 
          error.message?.includes('video source') ||
          error.message?.includes('Could not start video source') ||
          error.name === 'NotReadableError';
        
        if (isCameraPermissionError) {
          console.warn('Camera/microphone not auto-enabled - user can enable via VideoConference controls');
          // Don't show this as a critical error to the user
          return;
        }
        
        // Show other errors (connection issues, etc.)
        console.error('LiveKit error in doctor room:', error);
        onError(error);
      }}
    >
      <VideoConference />
    </LiveKitRoom>
  );
}



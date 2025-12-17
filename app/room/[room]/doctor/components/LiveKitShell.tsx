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
      audio
      video
      style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}
      onDisconnected={onDisconnected}
      onError={(error) => {
        console.error('LiveKit error in doctor room:', error);
        // Handle specific error types
        if (error.message?.includes('NotReadableError') || error.message?.includes('video source')) {
          console.error('Camera/video error - may need permission or device check');
        }
        onError(error);
      }}
    >
      <VideoConference />
    </LiveKitRoom>
  );
}



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
      connect
      audio
      video
      style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}
      onDisconnected={onDisconnected}
      onError={onError}
    >
      <VideoConference />
    </LiveKitRoom>
  );
}



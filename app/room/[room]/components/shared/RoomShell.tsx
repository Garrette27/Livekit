'use client';

import React from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import { useLiveKitChatUiFix } from '@/hooks/useLiveKitChatUiFix';
import LiveKitStyles from './LiveKitStyles';

interface RoomShellProps {
  token: string;
  onDisconnected: (reason?: unknown) => void;
  onError: (error: Error) => void;
  controlBarColor?: 'blue' | 'default';
}

export default function RoomShell({
  token,
  onDisconnected,
  onError,
  controlBarColor = 'blue',
}: RoomShellProps) {
  useLiveKitChatUiFix({ enabled: Boolean(token) });

  return (
    <>
      <LiveKitRoom
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://video-icebzbvf.livekit.cloud'}
        connect={true}
        audio
        video
        style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}
        onDisconnected={(reason) => onDisconnected(reason)}
        onError={onError}
      >
        <VideoConference />
      </LiveKitRoom>

      <LiveKitStyles controlBarColor={controlBarColor} />
    </>
  );
}

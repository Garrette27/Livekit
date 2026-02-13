'use client';

import React, { useRef } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import LiveKitStyles from './LiveKitStyles';
import { useRoomChatController } from './room-chat-controller';

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
  const roomScopeRef = useRef<HTMLDivElement | null>(null);
  useRoomChatController({ enabled: Boolean(token), scopeRef: roomScopeRef });

  return (
    <div ref={roomScopeRef} style={{ width: '100vw', height: '100vh', position: 'relative' }}>
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
    </div>
  );
}

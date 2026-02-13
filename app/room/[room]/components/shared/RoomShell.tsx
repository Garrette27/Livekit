'use client';

import React, { useMemo, useRef } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import LiveKitStyles from './LiveKitStyles';
import { RoomControlsPolicy } from './room-controls-policy';
import { RoomChatPolicy } from './room-chat-policy';
import { useRoomChatController } from './room-chat-controller';

interface RoomShellProps {
  token: string;
  onDisconnected: (reason?: unknown) => void;
  onError: (error: Error) => void;
  controlBarColor?: 'blue' | 'default';
  controlsPolicy?: RoomControlsPolicy;
  chatPolicy?: RoomChatPolicy;
}

const DEFAULT_CHAT_POLICY: RoomChatPolicy = {
  enabled: true,
  defaultOpen: false,
};

export default function RoomShell({
  token,
  onDisconnected,
  onError,
  controlBarColor = 'blue',
  controlsPolicy,
  chatPolicy = DEFAULT_CHAT_POLICY,
}: RoomShellProps) {
  const roomScopeRef = useRef<HTMLDivElement | null>(null);
  const chatEnabled = chatPolicy.enabled;
  const chatDefaultOpen = chatPolicy.defaultOpen;
  // LiveKit's chat state lives in VideoConference's internal layout context.
  // Mount this bridge inside that context so chat behavior stays policy-driven.
  const ChatControllerSettingsBridge = useMemo(() => {
    function RoomChatSettingsBridge() {
      useRoomChatController({ enabled: chatEnabled, defaultOpen: chatDefaultOpen });
      return null;
    }

    RoomChatSettingsBridge.displayName = 'RoomChatSettingsBridge';
    return RoomChatSettingsBridge;
  }, [chatDefaultOpen, chatEnabled]);

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
        <VideoConference SettingsComponent={ChatControllerSettingsBridge} />
      </LiveKitRoom>

      <LiveKitStyles
        controlBarColor={controlBarColor}
        controlsPolicy={controlsPolicy}
        chatEnabled={chatEnabled}
      />
    </div>
  );
}

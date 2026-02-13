'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LiveKitRoom, useParticipants, VideoConference } from '@livekit/components-react';
import LiveKitStyles from './LiveKitStyles';
import { RoomControlsPolicy } from './room-controls-policy';
import { RoomChatPolicy } from './room-chat-policy';
import { useRoomChatController } from './room-chat-controller';
import { RoomGridPolicy } from './room-grid-policy';

interface RoomShellProps {
  token: string;
  onDisconnected: (reason?: unknown) => void;
  onError: (error: Error) => void;
  controlBarColor?: 'blue' | 'default';
  controlsPolicy?: RoomControlsPolicy;
  chatPolicy?: RoomChatPolicy;
  gridPolicy?: RoomGridPolicy;
}

const DEFAULT_CHAT_POLICY: RoomChatPolicy = {
  enabled: true,
  defaultOpen: false,
};

const DEFAULT_GRID_POLICY: RoomGridPolicy = {
  enabled: true,
  maxParticipants: 40,
  mobileMaxColumns: 2,
};

function ParticipantCountBridge({ onCountChange }: { onCountChange: (count: number) => void }) {
  const participants = useParticipants();

  React.useEffect(() => {
    onCountChange(Math.max(1, participants.length));
  }, [onCountChange, participants.length]);

  return null;
}

export default function RoomShell({
  token,
  onDisconnected,
  onError,
  controlBarColor = 'blue',
  controlsPolicy,
  chatPolicy = DEFAULT_CHAT_POLICY,
  gridPolicy = DEFAULT_GRID_POLICY,
}: RoomShellProps) {
  const roomScopeRef = useRef<HTMLDivElement | null>(null);
  const [participantCount, setParticipantCount] = useState(1);
  const chatEnabled = chatPolicy.enabled;
  const chatDefaultOpen = chatPolicy.defaultOpen;
  const handleParticipantCountChange = useCallback((count: number) => {
    setParticipantCount((previous) => (previous === count ? previous : count));
  }, []);

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
        <ParticipantCountBridge onCountChange={handleParticipantCountChange} />
        <VideoConference SettingsComponent={ChatControllerSettingsBridge} />
      </LiveKitRoom>

      <LiveKitStyles
        controlBarColor={controlBarColor}
        controlsPolicy={controlsPolicy}
        chatEnabled={chatEnabled}
        gridPolicy={gridPolicy}
        participantCount={participantCount}
      />
    </div>
  );
}

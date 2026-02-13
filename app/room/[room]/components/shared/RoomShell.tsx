'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  LiveKitRoom,
  useChat,
  useLocalParticipant,
  useParticipants,
  VideoConference,
} from '@livekit/components-react';
import LiveKitStyles from './LiveKitStyles';
import { RoomControlsPolicy } from './room-controls-policy';
import { RoomChatPolicy } from './room-chat-policy';
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
  autoOpenOnIncomingMessage: true,
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

function isChatPanelVisible(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const chatPanel = document.querySelector<HTMLElement>('.lk-chat');
  if (!chatPanel) {
    return false;
  }

  const styles = window.getComputedStyle(chatPanel);
  return styles.display !== 'none' && styles.visibility !== 'hidden' && styles.opacity !== '0';
}

function findChatToggleButton(): HTMLButtonElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const directToggle = document.querySelector<HTMLButtonElement>('.lk-control-bar .lk-chat-toggle');
  if (directToggle) {
    return directToggle;
  }

  const candidates = Array.from(document.querySelectorAll<HTMLButtonElement>('.lk-control-bar button'));
  return (
    candidates.find((button) => {
      const label = (
        button.getAttribute('aria-label') ||
        button.getAttribute('title') ||
        button.textContent ||
        ''
      ).toLowerCase();
      return label.includes('chat');
    }) || null
  );
}

function openChatPanel(attempt = 0): void {
  if (isChatPanelVisible()) {
    return;
  }

  const chatToggleButton = findChatToggleButton();
  if (chatToggleButton) {
    chatToggleButton.click();
    return;
  }

  if (attempt >= 4 || typeof window === 'undefined') {
    return;
  }

  window.setTimeout(() => openChatPanel(attempt + 1), 120);
}

function ChatBehaviorBridge({
  enabled,
  defaultOpen,
  autoOpenOnIncomingMessage,
}: {
  enabled: boolean;
  defaultOpen: boolean;
  autoOpenOnIncomingMessage: boolean;
}) {
  const { chatMessages } = useChat();
  const { localParticipant } = useLocalParticipant();
  const initializedRef = React.useRef(false);
  const defaultAppliedRef = React.useRef(false);
  const lastProcessedMessageKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!enabled || defaultAppliedRef.current) {
      return;
    }

    defaultAppliedRef.current = true;
    if (defaultOpen) {
      openChatPanel();
    }
  }, [defaultOpen, enabled]);

  React.useEffect(() => {
    const latestMessage = chatMessages[chatMessages.length - 1];
    const latestMessageKey = latestMessage
      ? `${latestMessage.timestamp}-${latestMessage.from?.identity || 'unknown'}-${latestMessage.message}`
      : null;

    if (!initializedRef.current) {
      initializedRef.current = true;
      lastProcessedMessageKeyRef.current = latestMessageKey;
      return;
    }

    if (!enabled || !autoOpenOnIncomingMessage || !latestMessage) {
      return;
    }

    if (latestMessageKey === lastProcessedMessageKeyRef.current) {
      return;
    }

    lastProcessedMessageKeyRef.current = latestMessageKey;
    const senderIdentity = latestMessage.from?.identity;
    const isRemoteMessage = Boolean(senderIdentity && senderIdentity !== localParticipant?.identity);

    if (isRemoteMessage && !isChatPanelVisible()) {
      openChatPanel();
    }
  }, [autoOpenOnIncomingMessage, chatMessages, enabled, localParticipant?.identity]);

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
  const chatAutoOpenOnIncomingMessage = chatPolicy.autoOpenOnIncomingMessage;
  const handleParticipantCountChange = useCallback((count: number) => {
    setParticipantCount((previous) => (previous === count ? previous : count));
  }, []);

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
        <ChatBehaviorBridge
          enabled={chatEnabled}
          defaultOpen={chatDefaultOpen}
          autoOpenOnIncomingMessage={chatAutoOpenOnIncomingMessage}
        />
        <VideoConference />
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

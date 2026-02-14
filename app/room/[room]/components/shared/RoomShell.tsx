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
  consultationSessionId?: string | null;
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

  const chatToggleButton = findChatToggleButton();
  if (chatToggleButton) {
    const ariaPressed = chatToggleButton.getAttribute('aria-pressed');
    const isPressed = ariaPressed === 'true'
      || chatToggleButton.getAttribute('data-lk-active') === 'true'
      || chatToggleButton.classList.contains('lk-active');
    if (!isPressed) {
      return false;
    }
  }

  const chatPanel = document.querySelector<HTMLElement>('.lk-chat');
  if (!chatPanel) {
    return false;
  }

  const styles = window.getComputedStyle(chatPanel);
  const bounds = chatPanel.getBoundingClientRect();
  const hasSize = bounds.width > 16 && bounds.height > 16;

  return (
    styles.display !== 'none' &&
    styles.visibility !== 'hidden' &&
    styles.opacity !== '0' &&
    hasSize
  );
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
    const ariaPressed = chatToggleButton.getAttribute('aria-pressed');
    const isPressed = ariaPressed === 'true'
      || chatToggleButton.getAttribute('data-lk-active') === 'true'
      || chatToggleButton.classList.contains('lk-active');
    if (isPressed) {
      return;
    }
    chatToggleButton.click();
    return;
  }

  if (attempt >= 4 || typeof window === 'undefined') {
    return;
  }

  window.setTimeout(() => openChatPanel(attempt + 1), 120);
}

function toChatTimestampKey(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function inferSenderType(senderId: string): 'doctor' | 'patient' | 'system' {
  if (senderId.startsWith('doctor_')) {
    return 'doctor';
  }
  if (senderId.startsWith('patient_')) {
    return 'patient';
  }

  return 'system';
}

/**
 * Persists LiveKit chat messages into consultation session storage.
 * Idempotent message ids keep re-renders from creating duplicate records.
 */
function ChatPersistenceBridge({
  enabled,
  consultationSessionId,
}: {
  enabled: boolean;
  consultationSessionId?: string | null;
}) {
  const { chatMessages } = useChat();
  const persistedMessageIdsRef = React.useRef<Set<string>>(new Set());
  const activeSessionIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const normalizedSessionId =
      typeof consultationSessionId === 'string' && consultationSessionId.trim()
        ? consultationSessionId.trim()
        : null;
    if (activeSessionIdRef.current === normalizedSessionId) {
      return;
    }

    activeSessionIdRef.current = normalizedSessionId;
    persistedMessageIdsRef.current = new Set<string>();
  }, [consultationSessionId]);

  React.useEffect(() => {
    const normalizedSessionId =
      typeof consultationSessionId === 'string' && consultationSessionId.trim()
        ? consultationSessionId.trim()
        : null;
    if (!enabled || !normalizedSessionId) {
      return;
    }

    const persistMessages = async () => {
      for (const message of chatMessages) {
        const messageText = typeof message.message === 'string' ? message.message.trim() : '';
        if (!messageText) {
          continue;
        }

        const senderId = message.from?.identity || 'unknown';
        const senderName = message.from?.name || message.from?.identity || 'Unknown';
        const messageTimestamp = toChatTimestampKey(message.timestamp);
        const persistedMessageId =
          typeof message.id === 'string' && message.id.trim()
            ? message.id.trim()
            : `${senderId}:${messageTimestamp}:${messageText}`;

        if (persistedMessageIdsRef.current.has(persistedMessageId)) {
          continue;
        }

        persistedMessageIdsRef.current.add(persistedMessageId);
        try {
          const response = await fetch('/api/session-chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              consultationSessionId: normalizedSessionId,
              senderId,
              senderName,
              senderType: inferSenderType(senderId),
              text: messageText,
              messageId: persistedMessageId,
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to persist chat message (${response.status})`);
          }
        } catch (persistError) {
          persistedMessageIdsRef.current.delete(persistedMessageId);
          console.error('Failed to persist consultation chat message:', persistError);
        }
      }
    };

    void persistMessages();
  }, [chatMessages, consultationSessionId, enabled]);

  return null;
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

  const isLikelyRemoteMessage = React.useCallback(
    (message: (typeof chatMessages)[number] | undefined): boolean => {
      if (!message) {
        return false;
      }

      if (message.from?.isLocal === true) {
        return false;
      }

      const localIdentity = localParticipant?.identity;
      const senderIdentity = message.from?.identity;
      if (localIdentity && senderIdentity) {
        return localIdentity !== senderIdentity;
      }

      // If sender metadata is incomplete, treat the message as remote so users do not miss first replies.
      return true;
    },
    [localParticipant?.identity]
  );

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
    const latestTimestamp = (() => {
      const value = latestMessage?.timestamp as unknown;
      if (!value) {
        return 0;
      }
      if (value instanceof Date) {
        return value.getTime();
      }
      if (typeof value === 'number') {
        return value;
      }
      if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    })();
    const latestMessageKey = latestMessage
      ? `${chatMessages.length}:${latestTimestamp}:${latestMessage.from?.identity || 'unknown'}:${latestMessage.message}`
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

    if (isLikelyRemoteMessage(latestMessage) && !isChatPanelVisible()) {
      openChatPanel();
    }
  }, [autoOpenOnIncomingMessage, chatMessages, enabled, isLikelyRemoteMessage]);

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
  consultationSessionId = null,
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
        <ChatPersistenceBridge
          enabled={chatEnabled}
          consultationSessionId={consultationSessionId}
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

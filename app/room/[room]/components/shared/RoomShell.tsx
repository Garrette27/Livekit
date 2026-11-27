'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  LiveKitRoom,
  PreJoin,
  ConnectionStateToast,
  useChat,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  VideoConference,
  type LocalUserChoices,
} from '@livekit/components-react';
import { VideoPresets, type RoomOptions } from 'livekit-client';
import CallQualityMeter from './CallQualityMeter';
import LiveKitStyles from './LiveKitStyles';
import SessionTranscriptionBridge from './SessionTranscriptionBridge';
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

function ConnectionStatusBanner() {
  const connectionState = useConnectionState();
  const connected = connectionState === 'connected';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        top: '0.75rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        padding: '0.4rem 0.75rem',
        borderRadius: '9999px',
        backgroundColor: connected ? 'rgba(6, 95, 70, 0.92)' : 'rgba(146, 64, 14, 0.94)',
        color: '#fff',
        fontSize: '0.75rem',
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
      }}
    >
      {connected ? 'Connected' : `Connection: ${connectionState}`}
    </div>
  );
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
 * Persists only locally authored messages. Receivers must not save another
 * speaker's text using their own credential or multiply persistence requests.
 * Idempotent message ids keep re-renders from creating duplicate records.
 */
function ChatPersistenceBridge({
  enabled,
  consultationSessionId,
  accessToken,
}: {
  enabled: boolean;
  consultationSessionId?: string | null;
  accessToken: string;
}) {
  const { chatMessages } = useChat();
  const { localParticipant } = useLocalParticipant();
  const persistedMessageIdsRef = React.useRef<Set<string>>(new Set());
  // A room buffer can outlive the encounter prop. Failed/in-flight old messages
  // retain their original binding and must never be retried into a new visit.
  const messageSessionIdsRef = React.useRef<Map<string, string>>(new Map());

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
        if (!localParticipant?.identity || message.from?.identity !== localParticipant.identity) {
          continue;
        }
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

        const boundSessionId = messageSessionIdsRef.current.get(persistedMessageId);
        if (boundSessionId && boundSessionId !== normalizedSessionId) {
          continue;
        }
        messageSessionIdsRef.current.set(persistedMessageId, normalizedSessionId);

        if (persistedMessageIdsRef.current.has(persistedMessageId)) {
          continue;
        }

        persistedMessageIdsRef.current.add(persistedMessageId);
        try {
          const response = await fetch('/api/session-chat/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
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
  }, [accessToken, chatMessages, consultationSessionId, enabled, localParticipant?.identity]);

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


/**
 * Media quality settings, all standard LiveKit options:
 * - adaptiveStream: each receiver subscribes to a video size that matches the
 *   tile it renders and pauses video it cannot see;
 * - dynacast: the sender stops encoding layers nobody is receiving;
 * - simulcast (publish default): the sender offers several qualities so a weak
 *   receiver gets a lower layer instead of freezing;
 * - 720p capture target (the camera may deliver less; the receiver's delivered
 *   resolution is what to measure);
 * - browser echo cancellation, noise suppression and auto gain on the mic;
 *   RED (redundant audio) and DTX keep speech intelligible on lossy links.
 * None of these is a guaranteed quality level; they adapt to the network.
 */
const ROOM_MEDIA_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
  audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  publishDefaults: { simulcast: true, red: true, dtx: true },
};

const SPEECH_PROCESSING = { echoCancellation: true, noiseSuppression: true, autoGainControl: true } as const;
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
  const [userChoices, setUserChoices] = useState<LocalUserChoices | null>(null);
  const [transcriptionConsent, setTranscriptionConsent] = useState(false);
  const chatEnabled = chatPolicy.enabled;
  const chatDefaultOpen = chatPolicy.defaultOpen;
  const chatAutoOpenOnIncomingMessage = chatPolicy.autoOpenOnIncomingMessage;
  const handleParticipantCountChange = useCallback((count: number) => {
    setParticipantCount((previous) => (previous === count ? previous : count));
  }, []);

  if (!userChoices) {
    return (
      <main
        data-lk-theme="default"
        style={{
          minHeight: '100dvh',
          height: '100dvh',
          overflowY: 'auto',
          minWidth: 0,
          width: '100%',
          flex: 1,
          order: 2,
          display: 'grid',
          placeItems: 'center',
          padding: '1rem',
          background: '#0f172a',
        }}
      >
        <div style={{ width: 'min(100%, 52rem)' }}>
          <p
            style={{
              color: '#dbeafe',
              textAlign: 'center',
              margin: '0 0 0.75rem',
              fontSize: '0.875rem',
            }}
          >
            Check your microphone and camera. You can continue audio-only if video is unavailable.
          </p>
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.625rem',
              margin: '0 auto 0.875rem',
              padding: '0.75rem',
              maxWidth: '38rem',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              backgroundColor: '#1e293b',
              color: '#e2e8f0',
              fontSize: '0.8125rem',
              lineHeight: 1.45,
            }}
          >
            <input
              type="checkbox"
              checked={transcriptionConsent}
              onChange={(event) => setTranscriptionConsent(event.target.checked)}
              style={{ marginTop: '0.15rem' }}
            />
            <span>
              Allow my microphone audio to be transcribed for the AI consultation summary.
              This is optional; the call still works when it is off, and audio is discarded after transcription.
              We ask again when you rejoin; a previous room visit does not authorize a new recording.
            </span>
          </label>
          <PreJoin
            defaults={{
              username: 'Participant',
              audioEnabled: true,
              videoEnabled: true,
            }}
            joinLabel="Join consultation"
            persistUserChoices
            onSubmit={setUserChoices}
            onError={onError}
          />
        </div>
      </main>
    );
  }

  return (
    <div ref={roomScopeRef} style={{ width: '100%', minWidth: 0, height: '100dvh', position: 'relative', flex: 1, order: 2 }}>
      <LiveKitRoom
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://video-icebzbvf.livekit.cloud'}
        connect={true}
        options={ROOM_MEDIA_OPTIONS}
        audio={userChoices.audioEnabled ? { deviceId: userChoices.audioDeviceId, ...SPEECH_PROCESSING } : false}
        video={userChoices.videoEnabled ? { deviceId: userChoices.videoDeviceId } : false}
        style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
        onDisconnected={(reason) => onDisconnected(reason)}
        onError={onError}
      >
        <ParticipantCountBridge onCountChange={handleParticipantCountChange} />
        <ConnectionStatusBanner />
        <ConnectionStateToast />
        <CallQualityMeter />
        <ChatBehaviorBridge
          enabled={chatEnabled}
          defaultOpen={chatDefaultOpen}
          autoOpenOnIncomingMessage={chatAutoOpenOnIncomingMessage}
        />
        <ChatPersistenceBridge
          enabled={chatEnabled}
          consultationSessionId={consultationSessionId}
          accessToken={token}
        />
        <SessionTranscriptionBridge
          consultationSessionId={consultationSessionId}
          accessToken={token}
          consentConfirmed={transcriptionConsent}
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

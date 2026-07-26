'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SessionChatAttachment,
  SessionChatMessageInput,
  SessionChatVisibilityPolicy,
} from '@/lib/chat/session-chat-model';

interface SessionChatMessageDto {
  id: string;
  consultationSessionId: string;
  senderId: string;
  senderName: string;
  senderType: 'doctor' | 'patient' | 'system';
  text: string;
  attachments?: SessionChatAttachment[];
  createdAt: string | Date;
}

interface FetchSessionChatResponse {
  success: boolean;
  messages?: SessionChatMessageDto[];
  error?: string;
}

interface SendSessionChatResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface UseSessionChatOptions {
  accessToken?: string | null;
  consultationSessionId?: string | null;
  visibilityPolicy?: SessionChatVisibilityPolicy;
  participantJoinedAt?: Date | null;
  autoRefresh?: boolean;
  pollIntervalMs?: number;
}

interface UseSessionChatResult {
  messages: SessionChatMessageDto[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  sendMessage: (input: Omit<SessionChatMessageInput, 'consultationSessionId'>) => Promise<boolean>;
}

function toDateString(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.toISOString();
}

export function useSessionChat({
  accessToken,
  consultationSessionId,
  visibilityPolicy = 'join-time-only',
  participantJoinedAt = null,
  autoRefresh = true,
  pollIntervalMs = 5_000,
}: UseSessionChatOptions): UseSessionChatResult {
  const [messages, setMessages] = useState<SessionChatMessageDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!consultationSessionId || !accessToken) {
      setMessages([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        consultationSessionId,
        visibilityPolicy,
      });

      const participantJoinedAtIso = toDateString(participantJoinedAt);
      if (participantJoinedAtIso) {
        params.set('participantJoinedAt', participantJoinedAtIso);
      }

      const response = await fetch(`/api/session-chat/messages?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json()) as FetchSessionChatResponse;
      if (!response.ok || !result.success) {
        setError(result.error || 'Failed to load session chat');
        return;
      }

      setMessages(result.messages || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load session chat');
    } finally {
      setLoading(false);
    }
  }, [accessToken, consultationSessionId, participantJoinedAt, visibilityPolicy]);

  const sendMessage = useCallback(
    async (input: Omit<SessionChatMessageInput, 'consultationSessionId'>) => {
      if (!consultationSessionId || !accessToken) {
        setError('Missing consultation session or room access token');
        return false;
      }

      setSending(true);
      setError(null);
      try {
        const response = await fetch('/api/session-chat/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            ...input,
            consultationSessionId,
          }),
        });
        const result = (await response.json()) as SendSessionChatResponse;
        if (!response.ok || !result.success) {
          setError(result.error || 'Failed to send session chat message');
          return false;
        }

        await refresh();
        return true;
      } catch (sendError) {
        setError(sendError instanceof Error ? sendError.message : 'Failed to send session chat message');
        return false;
      } finally {
        setSending(false);
      }
    },
    [accessToken, consultationSessionId, refresh]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh || !consultationSessionId) {
      return;
    }

    const interval = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoRefresh, consultationSessionId, pollIntervalMs, refresh]);

  return useMemo(
    () => ({
      messages,
      loading,
      sending,
      error,
      refresh,
      sendMessage,
    }),
    [error, loading, messages, refresh, sendMessage, sending]
  );
}

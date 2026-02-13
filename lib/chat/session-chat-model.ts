export type SessionChatVisibilityPolicy = 'join-time-only' | 'full-history';
export type SessionChatSenderType = 'doctor' | 'patient' | 'system';

export interface SessionChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  downloadUrl?: string | null;
  storagePath?: string | null;
  extractedText?: string | null;
  extractionStatus?: 'pending' | 'ready' | 'failed' | null;
}

export interface SessionChatMessage {
  id: string;
  consultationSessionId: string;
  senderId: string;
  senderName: string;
  senderType: SessionChatSenderType;
  text: string;
  attachments: SessionChatAttachment[];
  createdAt: Date;
}

export interface SessionChatMessageInput {
  consultationSessionId: string;
  senderId: string;
  senderName: string;
  senderType: SessionChatSenderType;
  text: string;
  attachments?: SessionChatAttachment[];
}

/**
 * Resolve if a message is visible for participant based on policy and participant join time.
 */
export function isMessageVisibleForParticipant(
  messageCreatedAt: Date,
  participantJoinedAt: Date | null | undefined,
  policy: SessionChatVisibilityPolicy
): boolean {
  if (policy === 'full-history') {
    return true;
  }

  if (!participantJoinedAt) {
    return false;
  }

  return messageCreatedAt.getTime() >= participantJoinedAt.getTime();
}

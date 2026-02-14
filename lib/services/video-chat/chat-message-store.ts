import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  isMessageVisibleForParticipant,
  type SessionChatVisibilityPolicy,
} from '@/lib/chat/session-chat-model';
import type { ChatMessageStore, NormalizedChatMessage, NormalizedChatMessageInput } from './contracts';

interface DateLike {
  toDate?: () => Date;
  toMillis?: () => number;
}

function toDate(value: unknown): Date {
  if (!value) {
    return new Date(0);
  }

  if (value instanceof Date) {
    return value;
  }

  const maybeDateLike = value as DateLike;
  if (typeof maybeDateLike.toDate === 'function') {
    return maybeDateLike.toDate();
  }
  if (typeof maybeDateLike.toMillis === 'function') {
    return new Date(maybeDateLike.toMillis());
  }

  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function normalizeMessageDoc(input: {
  id: string;
  data: Record<string, unknown>;
}): NormalizedChatMessage {
  return {
    id: input.id,
    senderId: String(input.data.senderId || ''),
    senderName: String(input.data.senderName || ''),
    senderType: (input.data.senderType as NormalizedChatMessage['senderType']) || 'system',
    message: String(input.data.text || ''),
    attachments: Array.isArray(input.data.attachments)
      ? (input.data.attachments as NormalizedChatMessage['attachments'])
      : [],
    sentAt: toDate(input.data.createdAt || input.data.createdAtIso),
  };
}

/**
 * Firestore-backed chat store that hides idempotency and visibility rules.
 */
export class FirestoreChatMessageStore implements ChatMessageStore {
  constructor(private readonly db: Firestore) {}

  async appendMessage(input: NormalizedChatMessageInput): Promise<{ messageId: string; duplicated: boolean }> {
    const messageText = input.message.trim();
    const attachments = input.attachments || [];
    if (!messageText && attachments.length === 0) {
      throw new Error('Message must include text or attachment');
    }

    const messagesRef = this.db
      .collection('consultationSessions')
      .doc(input.sessionId)
      .collection('messages');

    const payload = {
      consultationSessionId: input.sessionId,
      senderId: input.senderId,
      senderName: input.senderName,
      senderType: input.senderType,
      text: messageText,
      attachments,
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: new Date().toISOString(),
    };

    if (input.messageId) {
      const messageRef = messagesRef.doc(input.messageId);
      const existingDoc = await messageRef.get();
      if (existingDoc.exists) {
        return {
          messageId: existingDoc.id,
          duplicated: true,
        };
      }

      await messageRef.set(payload, { merge: false });
      await this.db.collection('consultationSessions').doc(input.sessionId).set(
        {
          lastMessageAt: Timestamp.now(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        messageId: messageRef.id,
        duplicated: false,
      };
    }

    const createdMessageRef = await messagesRef.add(payload);
    await this.db.collection('consultationSessions').doc(input.sessionId).set(
      {
        lastMessageAt: Timestamp.now(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      messageId: createdMessageRef.id,
      duplicated: false,
    };
  }

  async listVisibleMessages(input: {
    sessionId: string;
    participantId: string;
    participantJoinedAt?: Date | null;
    visibilityPolicy: SessionChatVisibilityPolicy;
  }): Promise<NormalizedChatMessage[]> {
    const snapshot = await this.db
      .collection('consultationSessions')
      .doc(input.sessionId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .limit(500)
      .get();

    return snapshot.docs
      .map((doc) => normalizeMessageDoc({ id: doc.id, data: doc.data() as Record<string, unknown> }))
      .filter((message) =>
        isMessageVisibleForParticipant(message.sentAt, input.participantJoinedAt, input.visibilityPolicy)
      );
  }
}

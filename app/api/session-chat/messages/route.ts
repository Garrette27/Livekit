import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import {
  isMessageVisibleForParticipant,
  SessionChatMessageInput,
  SessionChatVisibilityPolicy,
} from '@/lib/chat/session-chat-model';

interface DateLike {
  toDate?: () => Date;
}

function toDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }

  const maybeDateLike = value as DateLike;
  if (typeof maybeDateLike?.toDate === 'function') {
    return maybeDateLike.toDate();
  }

  const parsed = new Date(value as string | number | Date);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0);
  }

  return parsed;
}

function parseVisibilityPolicy(raw: string | null): SessionChatVisibilityPolicy {
  return raw === 'full-history' ? 'full-history' : 'join-time-only';
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const consultationSessionId = searchParams.get('consultationSessionId');
    const visibilityPolicy = parseVisibilityPolicy(searchParams.get('visibilityPolicy'));
    const participantJoinedAtRaw = searchParams.get('participantJoinedAt');
    const participantJoinedAt = participantJoinedAtRaw ? toDate(participantJoinedAtRaw) : null;

    if (!consultationSessionId) {
      return NextResponse.json(
        { success: false, error: 'consultationSessionId is required' },
        { status: 400 }
      );
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    const messagesSnapshot = await db
      .collection('consultationSessions')
      .doc(consultationSessionId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .limit(500)
      .get();

    const messages = messagesSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        const createdAt = toDate(data.createdAt);
        return {
          id: doc.id,
          ...data,
          createdAt,
        };
      })
      .filter((message) =>
        isMessageVisibleForParticipant(message.createdAt, participantJoinedAt, visibilityPolicy)
      );

    return NextResponse.json({
      success: true,
      messages,
      visibilityPolicy,
    });
  } catch (error) {
    console.error('Error fetching session chat messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SessionChatMessageInput;
    const {
      consultationSessionId,
      senderId,
      senderName,
      senderType,
      text,
      attachments = [],
    } = body;

    if (!consultationSessionId || !senderId || !senderName || !senderType) {
      return NextResponse.json(
        { success: false, error: 'Missing required message fields' },
        { status: 400 }
      );
    }

    if (!text?.trim() && attachments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message must include text or attachment' },
        { status: 400 }
      );
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    const messagePayload = {
      consultationSessionId,
      senderId,
      senderName,
      senderType,
      text: text?.trim() || '',
      attachments,
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: new Date().toISOString(),
    };

    const messageRef = await db
      .collection('consultationSessions')
      .doc(consultationSessionId)
      .collection('messages')
      .add(messagePayload);

    await db.collection('consultationSessions').doc(consultationSessionId).set(
      {
        lastMessageAt: Timestamp.now(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      messageId: messageRef.id,
    });
  } catch (error) {
    console.error('Error storing session chat message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to store message' },
      { status: 500 }
    );
  }
}

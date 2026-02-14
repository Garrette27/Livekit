import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import type { SessionChatVisibilityPolicy } from '@/lib/chat/session-chat-model';
import { FirestoreChatMessageStore } from '@/lib/services/video-chat';

function toDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseVisibilityPolicy(raw: string | null): SessionChatVisibilityPolicy {
  return raw === 'full-history' ? 'full-history' : 'join-time-only';
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const consultationSessionId = searchParams.get('consultationSessionId');
    const visibilityPolicy = parseVisibilityPolicy(searchParams.get('visibilityPolicy'));
    const participantJoinedAt = toDate(searchParams.get('participantJoinedAt'));
    const participantId = searchParams.get('participantId') || 'anonymous';

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

    const chatStore = new FirestoreChatMessageStore(db);
    const messages = await chatStore.listVisibleMessages({
      sessionId: consultationSessionId,
      participantId,
      participantJoinedAt,
      visibilityPolicy,
    });

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
    const body = await req.json();
    const consultationSessionId =
      typeof body.consultationSessionId === 'string' ? body.consultationSessionId.trim() : '';
    const senderId = typeof body.senderId === 'string' ? body.senderId.trim() : '';
    const senderName = typeof body.senderName === 'string' ? body.senderName.trim() : '';
    const senderType = body.senderType as 'doctor' | 'patient' | 'system';
    const text = typeof body.text === 'string' ? body.text : '';
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : undefined;

    if (!consultationSessionId || !senderId || !senderName || !senderType) {
      return NextResponse.json(
        { success: false, error: 'Missing required message fields' },
        { status: 400 }
      );
    }
    if (senderType !== 'doctor' && senderType !== 'patient' && senderType !== 'system') {
      return NextResponse.json(
        { success: false, error: 'senderType must be doctor, patient, or system' },
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

    const chatStore = new FirestoreChatMessageStore(db);
    const result = await chatStore.appendMessage({
      sessionId: consultationSessionId,
      messageId,
      senderId,
      senderName,
      senderType,
      message: text,
      attachments,
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      duplicated: result.duplicated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to store message';
    const status = message.includes('Message must include text or attachment') ? 400 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

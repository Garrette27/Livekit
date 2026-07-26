import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import type { SessionChatVisibilityPolicy } from '@/lib/chat/session-chat-model';
import { FirestoreChatMessageStore } from '@/lib/services/video-chat';
import { authorizeSessionParticipant } from '@/lib/services/shared/session-participant-auth';
import { serviceResultToResponse } from '@/lib/services/shared/http';

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

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const consultationSessionId = searchParams.get('consultationSessionId');
    const requestedVisibilityPolicy = parseVisibilityPolicy(searchParams.get('visibilityPolicy'));
    const requestedParticipantJoinedAt = toDate(searchParams.get('participantJoinedAt'));

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

    const participant = await authorizeSessionParticipant(req, db, consultationSessionId);
    if (!participant.ok) {
      return serviceResultToResponse(participant);
    }
    const visibilityPolicy = participant.data.participantType === 'doctor'
      ? requestedVisibilityPolicy
      : 'join-time-only';
    const participantJoinedAt = participant.data.participantType === 'doctor'
      ? requestedParticipantJoinedAt
      : participant.data.joinedAt;

    const chatStore = new FirestoreChatMessageStore(db);
    const messages = await chatStore.listVisibleMessages({
      sessionId: consultationSessionId,
      participantId: participant.data.identity,
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

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    const consultationSessionId =
      typeof body.consultationSessionId === 'string' ? body.consultationSessionId.trim() : '';
    const text = typeof body.text === 'string' ? body.text : '';
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : undefined;

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

    const participant = await authorizeSessionParticipant(req, db, consultationSessionId);
    if (!participant.ok) {
      return serviceResultToResponse(participant);
    }

    const chatStore = new FirestoreChatMessageStore(db);
    const result = await chatStore.appendMessage({
      sessionId: consultationSessionId,
      messageId,
      senderId: participant.data.identity,
      senderName: participant.data.participantName,
      senderType: participant.data.participantType,
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

export const GET = withRequestLogging(handleGET);
export const POST = withRequestLogging(handlePOST);

import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import type { SessionChatVisibilityPolicy } from '@/lib/chat/session-chat-model';
import { FirestoreChatMessageStore } from '@/lib/services/video-chat';
import { authorizeSessionParticipant } from '@/lib/services/shared/session-participant-auth';
import { serviceResultToResponse } from '@/lib/services/shared/http';
import { isConsultationCapabilityEnabled } from '@/lib/consultations/consultation-capabilities';
import { AttachmentRepository } from '@/lib/repositories/attachment-repository';

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
      messages: messages.map((message) => ({
        id: message.id,
        consultationSessionId,
        senderId: message.senderId,
        senderName: message.senderName,
        senderType: message.senderType,
        text: message.message,
        attachments: message.attachments || [],
        createdAt: message.sentAt.toISOString(),
      })),
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
    if (Array.isArray(body.attachments) && body.attachments.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Attachment metadata must be resolved by the server' },
        { status: 400 }
      );
    }
    const attachmentIds: string[] = Array.isArray(body.attachmentIds)
      ? Array.from(
          new Set<string>(
            body.attachmentIds.filter((value: unknown): value is string =>
              typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
            )
          )
        ).slice(0, 10)
      : [];
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

    if (attachmentIds.length > 0 && !isConsultationCapabilityEnabled('file-attachments')) {
      return NextResponse.json(
        { success: false, error: 'File attachments are not enabled' },
        { status: 404 }
      );
    }
    const attachments = attachmentIds.length > 0
      ? await new AttachmentRepository(db).resolveMessageReferences(
          consultationSessionId,
          attachmentIds,
          participant.data.identity
        )
      : [];

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

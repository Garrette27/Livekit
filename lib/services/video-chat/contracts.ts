import type { SessionChatVisibilityPolicy } from '@/lib/chat/session-chat-model';
import type { ConsultationPresenceEventType } from '@/lib/consultations/consultation-session-store';
import type { SignOptions } from 'jsonwebtoken';

export interface StartSessionInput {
  roomName: string;
  doctorUserId: string;
  patientUserId?: string | null;
  patientEmail?: string | null;
  patientName?: string | null;
  existingData?: Record<string, unknown> | null;
  now?: Date;
  allowCompletedReuse?: boolean;
}

export interface StartSessionResult {
  sessionId: string;
  sessionStartedAt: Date;
  eventType: ConsultationPresenceEventType;
  reusedExistingSession: boolean;
}

export interface AppendSessionEventInput {
  sessionId: string;
  roomName: string;
  doctorUserId?: string | null;
  patientUserId?: string | null;
  actorType: 'doctor' | 'patient' | 'system';
  actorId?: string | null;
  eventType: ConsultationPresenceEventType;
  eventAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface CloseSessionInput {
  sessionId: string;
  roomName: string;
  doctorUserId?: string | null;
  patientUserId?: string | null;
  sessionStartedAt: Date;
  sessionEndedAt: Date;
  metadata?: Record<string, unknown>;
  eventType?: ConsultationPresenceEventType;
  actorType?: 'doctor' | 'patient' | 'system';
  actorId?: string | null;
}

export interface ConsultationSessionStore {
  startSession(input: StartSessionInput): Promise<StartSessionResult>;
  appendEvent(input: AppendSessionEventInput): Promise<void>;
  closeSession(input: CloseSessionInput): Promise<void>;
}

export interface NormalizedChatMessageInput {
  sessionId: string;
  messageId?: string;
  senderId: string;
  senderName: string;
  senderType: 'doctor' | 'patient' | 'system';
  message: string;
  attachments?: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    extractionStatus?: 'pending' | 'ready' | 'failed' | null;
  }>;
}

export interface NormalizedChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'doctor' | 'patient' | 'system';
  message: string;
  attachments: NormalizedChatMessageInput['attachments'];
  sentAt: Date;
}

export interface ChatMessageStore {
  appendMessage(input: NormalizedChatMessageInput): Promise<{ messageId: string; duplicated: boolean }>;
  listVisibleMessages(input: {
    sessionId: string;
    participantId: string;
    participantJoinedAt?: Date | null;
    visibilityPolicy: SessionChatVisibilityPolicy;
  }): Promise<NormalizedChatMessage[]>;
}

export interface IssueRtcRoomTokenInput {
  subject: string;
  roomName: string;
  participantName: string;
  expiresIn: SignOptions['expiresIn'];
}

export interface RtcTransportAdapter {
  issueRoomToken(input: IssueRtcRoomTokenInput): string;
  disconnectParticipant(input: { roomName: string; participantIdentity: string }): Promise<void>;
}

import type { Firestore } from 'firebase-admin/firestore';
import { finalizeConsultationForRoom } from '@/lib/services/consultation-finalization';
import { FirestoreInvitationAccessCore } from '@/lib/services/invitation-access';

type SupportedWebhookEventType = 'participant_left' | 'room_finished';

interface LiveKitWebhookEvent {
  event?: string;
  createdAt?: string | number;
  room?: {
    name?: string;
  };
  participant?: {
    identity?: string;
    metadata?: string | Record<string, unknown>;
  };
}

export interface WebhookFinalizationFallbackResult {
  handled: boolean;
  reason: string;
  roomName: string | null;
  waitingPatientId: string | null;
}

function resolveSupportedEventType(event: LiveKitWebhookEvent): SupportedWebhookEventType | null {
  if (event.event === 'participant_left' || event.event === 'room_finished') {
    return event.event;
  }
  return null;
}

function normalizeRoomName(roomName: string | undefined): string | null {
  const normalized = roomName?.trim() || '';
  return normalized.length > 0 ? normalized : null;
}

function resolveSessionRoomName(roomName: string | null): string | null {
  if (!roomName) {
    return null;
  }

  return roomName.endsWith('-waiting') ? roomName.slice(0, -'-waiting'.length) : roomName;
}

function parseParticipantMetadata(rawMetadata: unknown): Record<string, unknown> {
  if (!rawMetadata) {
    return {};
  }

  if (typeof rawMetadata === 'object') {
    return rawMetadata as Record<string, unknown>;
  }

  if (typeof rawMetadata !== 'string') {
    return {};
  }

  try {
    const parsed = JSON.parse(rawMetadata);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function isDoctorParticipant(input: {
  participantIdentity: string | null;
  participantMetadata: Record<string, unknown>;
}): boolean {
  const participantType = input.participantMetadata.participantType;
  return input.participantIdentity?.startsWith('doctor_') === true || participantType === 'doctor';
}

/**
 * Resolve waiting patient id from LiveKit identity:
 * patient_<invitationId>_<waitingPatientId>
 */
function extractWaitingPatientId(identity: string | null): string | null {
  if (!identity || !identity.startsWith('patient_')) {
    return null;
  }

  const waitingMarkerIndex = identity.indexOf('_waiting_');
  if (waitingMarkerIndex < 0) {
    return null;
  }

  const waitingPatientId = identity.slice(waitingMarkerIndex + 1).trim();
  return waitingPatientId.startsWith('waiting_') ? waitingPatientId : null;
}

function resolveEventTimestamp(event: LiveKitWebhookEvent): Date {
  const raw = event.createdAt;
  if (typeof raw === 'string' || typeof raw === 'number') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return new Date(parsed * 1000);
    }
  }

  return new Date();
}

async function handleParticipantLeftWithWaitingEntry(input: {
  db: Firestore;
  waitingPatientId: string;
  roomName: string;
}): Promise<{
  handled: boolean;
  reason: string;
  status: 'left' | 'rejected' | null;
}> {
  const invitationAccess = new FirestoreInvitationAccessCore(input.db);
  return invitationAccess.handleParticipantLeftWebhook({
    waitingPatientId: input.waitingPatientId,
    roomName: input.roomName,
  });
}

async function finalizeSessionFromWebhook(input: {
  db: Firestore;
  roomName: string;
  reason: 'patient_left_webhook' | 'room_finished_webhook';
  finalizedAt: Date;
}): Promise<boolean> {
  // Accept the most recent session even if it has already been marked
  // 'completed' by an earlier code path (e.g. track-consultation leave or
  // closeSession). Without this, room_finished webhooks routinely log
  // 'no_active_session_to_finalize' and the AI summary is never generated.
  // Idempotency for summary writes is enforced inside
  // generateAndStoreConsultationSummary via shouldSkipSummaryRegeneration.
  const finalizedSession = await finalizeConsultationForRoom(input.db, {
    roomName: input.roomName,
    finalizedAt: input.finalizedAt,
    reason: input.reason,
    requireActiveSession: false,
    regenerateSummary: true,
  });

  return Boolean(finalizedSession);
}

/**
 * Fallback lifecycle finalization for mobile/tab-kill flows.
 * This runs only for LiveKit participant-left and room-finished events.
 */
export async function processWebhookFinalizationFallback(
  db: Firestore,
  rawEvent: unknown
): Promise<WebhookFinalizationFallbackResult> {
  const event = (rawEvent || {}) as LiveKitWebhookEvent;
  const supportedEventType = resolveSupportedEventType(event);
  const roomName = normalizeRoomName(event.room?.name);
  if (!supportedEventType) {
    return {
      handled: false,
      reason: 'unsupported_event',
      roomName,
      waitingPatientId: null,
    };
  }

  if (!roomName) {
    return {
      handled: false,
      reason: 'missing_room_name',
      roomName: null,
      waitingPatientId: null,
    };
  }

  if (supportedEventType === 'room_finished') {
    const sessionRoomName = resolveSessionRoomName(roomName);
    if (!sessionRoomName || roomName.endsWith('-waiting')) {
      return {
        handled: false,
        reason: 'waiting_room_finished_no_session_finalization',
        roomName,
        waitingPatientId: null,
      };
    }

    const finalized = await finalizeSessionFromWebhook({
      db,
      roomName: sessionRoomName,
      reason: 'room_finished_webhook',
      finalizedAt: resolveEventTimestamp(event),
    });

    return {
      handled: finalized,
      reason: finalized ? 'session_finalized_from_room_finished' : 'no_active_session_to_finalize',
      roomName,
      waitingPatientId: null,
    };
  }

  const participantIdentity = event.participant?.identity?.trim() || null;
  const participantMetadata = parseParticipantMetadata(event.participant?.metadata);
  if (isDoctorParticipant({ participantIdentity, participantMetadata })) {
    return {
      handled: false,
      reason: 'doctor_participant_ignored',
      roomName,
      waitingPatientId: null,
    };
  }

  const waitingPatientId = extractWaitingPatientId(participantIdentity);
  if (waitingPatientId) {
    const waitingEntryResult = await handleParticipantLeftWithWaitingEntry({
      db,
      waitingPatientId,
      roomName,
    });
    return {
      handled: waitingEntryResult.handled,
      reason: waitingEntryResult.reason,
      roomName,
      waitingPatientId,
    };
  }

  const sessionRoomName = resolveSessionRoomName(roomName);
  if (!sessionRoomName || roomName.endsWith('-waiting')) {
    return {
      handled: false,
      reason: 'no_waiting_patient_id_and_waiting_room_event',
      roomName,
      waitingPatientId: null,
    };
  }

  const finalized = await finalizeSessionFromWebhook({
    db,
    roomName: sessionRoomName,
    reason: 'patient_left_webhook',
    finalizedAt: resolveEventTimestamp(event),
  });
  return {
    handled: finalized,
    reason: finalized ? 'session_finalized_from_participant_left' : 'no_active_session_to_finalize',
    roomName,
    waitingPatientId: null,
  };
}

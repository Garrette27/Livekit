import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { enforceRateLimit, RateLimitConfigs } from '@/lib/rate-limit';
import { ConsultationTranscriptRepository } from '@/lib/repositories/consultation-transcript-repository';
import { FirestoreSummaryProjectionService } from '@/lib/services/history-summary';
import { authorizeSessionParticipant } from '@/lib/services/shared/session-participant-auth';
import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { OpenAiAudioTranscriber } from '@/lib/services/transcription/openai-audio-transcriber';

export const maxDuration = 60;

const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const MAX_CHUNK_DURATION_MS = 15_000;
const CAPTURE_ID_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;
const ACCEPTED_AUDIO_TYPES = new Set([
  'audio/webm',
  'video/webm',
  'audio/mp4',
  'video/mp4',
  'audio/mpeg',
  'audio/x-m4a',
]);

function parseInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
    return 'mp4';
  }
  if (mimeType.includes('mpeg')) {
    return 'mp3';
  }
  return 'webm';
}

/**
 * Accepts a short, isolated microphone-track recording, verifies that its
 * LiveKit credential belongs to the session, transcribes it without retaining
 * audio, and appends an idempotent speaker-attributed evidence segment.
 */
async function handlePOST(req: NextRequest) {
  const requestReceivedAtMs = Date.now();
  const rateLimitResponse = await enforceRateLimit(req, RateLimitConfigs.GENERAL);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > MAX_AUDIO_BYTES + 64 * 1024) {
    return NextResponse.json({ success: false, error: 'Audio chunk is too large' }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid transcription payload' }, { status: 400 });
  }

  const consultationSessionId =
    typeof form.get('consultationSessionId') === 'string'
      ? String(form.get('consultationSessionId')).trim()
      : '';
  const captureId = typeof form.get('captureId') === 'string' ? String(form.get('captureId')).trim() : '';
  const sequence = parseInteger(form.get('sequence'));
  const durationMs = parseInteger(form.get('durationMs'));
  const audioValue = form.get('audio');
  const consentConfirmed = form.get('consentConfirmed') === 'true';

  if (
    !consultationSessionId
    || !CAPTURE_ID_PATTERN.test(captureId)
    || sequence === null
    || sequence < 0
    || sequence > 100_000
    || durationMs === null
    || durationMs < 250
    || durationMs > MAX_CHUNK_DURATION_MS
    || !(audioValue instanceof Blob)
    || !consentConfirmed
  ) {
    return NextResponse.json({ success: false, error: 'Invalid transcription chunk metadata' }, { status: 400 });
  }

  const normalizedMimeType = audioValue.type.toLowerCase().split(';')[0];
  if (
    audioValue.size === 0
    || audioValue.size > MAX_AUDIO_BYTES
    || !ACCEPTED_AUDIO_TYPES.has(normalizedMimeType)
  ) {
    return NextResponse.json({ success: false, error: 'Unsupported audio chunk' }, { status: 415 });
  }

  const db = getFirebaseAdmin();
  if (!db) {
    return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 });
  }

  const participant = await authorizeSessionParticipant(req, db, consultationSessionId);
  if (!participant.ok) {
    return NextResponse.json(
      { success: false, error: participant.error.message, code: participant.error.code },
      { status: participant.error.status }
    );
  }

  try {
    const transcription = await new OpenAiAudioTranscriber().transcribe({
      audio: audioValue,
      filename: `participant-audio.${extensionForMimeType(normalizedMimeType)}`,
    });
    if (!transcription.text) {
      return NextResponse.json({ success: true, noSpeech: true });
    }

    const transcriptRepository = new ConsultationTranscriptRepository(db);
    const appendResult = await transcriptRepository.appendSegment({
      consultationSessionId,
      participantIdentity: participant.data.identity,
      participantName: participant.data.participantName,
      speakerType: participant.data.participantType,
      captureId,
      sequence,
      // Use one trusted server clock for cross-participant ordering. Client
      // clocks can differ by minutes and would scramble who spoke when.
      capturedAt: new Date(requestReceivedAtMs - durationMs),
      durationMs,
      text: transcription.text,
      model: transcription.model,
      consentConfirmed,
    });

    // If an in-flight chunk lands just after finalization, rebuild from the
    // newer transcript revision. Revision-aware summary writes prevent an
    // older concurrent generation from overwriting a newer one.
    if (appendResult.inserted && appendResult.sessionStatus === 'completed') {
      try {
        await new FirestoreSummaryProjectionService(db).buildSummary({
          consultationSessionId,
          regenerate: true,
        });
      } catch (refreshError) {
        console.warn('Stored a late transcript segment but could not refresh its summary:', refreshError);
      }
    }

    return NextResponse.json({
      success: true,
      duplicated: !appendResult.inserted,
      transcriptRevision: appendResult.revision,
    });
  } catch (error) {
    console.error(
      'Session audio transcription failed:',
      error instanceof Error ? error.message : 'Unknown transcription error'
    );
    const status = error instanceof Error && error.message.includes('not configured') ? 503 : 502;
    return NextResponse.json(
      { success: false, error: 'Audio transcription is temporarily unavailable' },
      { status }
    );
  }
}

export const POST = withRequestLogging(handlePOST);

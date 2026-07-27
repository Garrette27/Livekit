import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { isKnownUserId } from '@/lib/consultations/identity-utils';
import { resolveAiEntitlement } from '@/lib/ai/ai-entitlement-policy';
import { CallSummaryRepository } from '@/lib/repositories/call-summary-repository';
import { CallRepository } from '@/lib/repositories/call-repository';
import { AttachmentRepository } from '@/lib/repositories/attachment-repository';
import { SummaryJobRepository } from '@/lib/repositories/summary-job-repository';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { GenerateConsultationSummaryParams } from './contracts';

interface ParsedSummary {
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  followUpActions: string[];
  riskLevel: string;
  category: string;
}

type PresenceEventType = 'joined' | 'left' | 'rejoined' | 'admitted_to_consultation' | 'patient_removed_by_doctor';

interface PresenceTimelineEvent {
  eventType: PresenceEventType;
  actorType: 'patient' | 'doctor' | 'system' | 'unknown';
  eventAt: Date;
  label: string;
}

interface PresenceTimeline {
  events: PresenceTimelineEvent[];
  joinedCount: number;
  leftCount: number;
  rejoinCount: number;
  admittedCount: number;
  removedByDoctorCount: number;
  hadDisconnect: boolean;
  hadRejoin: boolean;
  promptContext: string;
  narrative: string;
}

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_TIMEOUT_MS = 25_000;

/**
 * Calls OpenAI with a bounded timeout and one retry on transient failures
 * (timeouts, rate limits, 5xx). Without the bound, a hung request would eat
 * the serverless time budget and finalization would die before it could even
 * store a fallback summary.
 */
async function requestOpenAiCompletion(requestBody: string): Promise<Response> {
  const attempt = () =>
    fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: requestBody,
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });

  try {
    const response = await attempt();
    if (response.status !== 429 && response.status < 500) {
      return response;
    }
    console.warn('Transient OpenAI error, retrying once:', response.status);
  } catch (error) {
    console.warn('OpenAI request failed, retrying once:', error);
  }

  return attempt();
}

function toDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }

  if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return new Date((value as { toMillis: () => number }).toMillis());
  }

  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatPromptTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', ' UTC');
}

function getPresenceEventLabel(eventType: PresenceEventType): string {
  if (eventType === 'joined') {
    return 'Patient joined consultation';
  }

  if (eventType === 'rejoined') {
    return 'Patient rejoined consultation';
  }

  if (eventType === 'admitted_to_consultation') {
    return 'Patient admitted to consultation';
  }

  if (eventType === 'patient_removed_by_doctor') {
    return 'Patient removed by doctor';
  }

  return 'Patient left consultation';
}

function buildPresenceTimelineNarrative(timeline: PresenceTimeline | null): string | null {
  if (!timeline || timeline.events.length === 0) {
    return null;
  }

  const sequence = timeline.events
    .map((event) => `${event.eventType}@${event.eventAt.toISOString()}`)
    .join(' -> ');

  const eventSummary = [
    `joined=${timeline.joinedCount}`,
    `left=${timeline.leftCount}`,
    `rejoined=${timeline.rejoinCount}`,
    `admitted=${timeline.admittedCount}`,
    `removed=${timeline.removedByDoctorCount}`,
  ].join(', ');

  return `Patient presence timeline (${eventSummary}): ${sequence}.`;
}

function buildPresenceTimelinePromptContext(timelineEvents: PresenceTimelineEvent[]): string {
  if (!timelineEvents.length) {
    return 'No explicit patient join/leave timeline events were captured.';
  }

  return timelineEvents
    .map((event, index) => `${index + 1}. ${event.label} at ${formatPromptTimestamp(event.eventAt)}`)
    .join('\n');
}

function buildPresenceTimelineMetadata(timeline: PresenceTimeline | null): Record<string, unknown> {
  if (!timeline) {
    return {
      hasPresenceTimeline: false,
      presenceTimelineEvents: 0,
      patientJoinedCount: 0,
      patientLeftCount: 0,
      patientRejoinCount: 0,
      patientAdmittedCount: 0,
      patientRemovedByDoctorCount: 0,
      patientHadDisconnect: false,
      patientHadRejoin: false,
    };
  }

  return {
    hasPresenceTimeline: timeline.events.length > 0,
    presenceTimelineEvents: timeline.events.length,
    patientJoinedCount: timeline.joinedCount,
    patientLeftCount: timeline.leftCount,
    patientRejoinCount: timeline.rejoinCount,
    patientAdmittedCount: timeline.admittedCount,
    patientRemovedByDoctorCount: timeline.removedByDoctorCount,
    patientHadDisconnect: timeline.hadDisconnect,
    patientHadRejoin: timeline.hadRejoin,
  };
}

function augmentKeyPointsWithPresenceTimeline(
  keyPoints: string[],
  timeline: PresenceTimeline | null
): string[] {
  if (!timeline || timeline.events.length === 0) {
    return keyPoints;
  }

  const timelineKeyPoint = `Patient connection timeline: ${timeline.events
    .map((event) => event.eventType)
    .join(' -> ')}`;

  const hasSimilarPoint = keyPoints.some((point) =>
    point.toLowerCase().includes('connection timeline')
    || point.toLowerCase().includes('rejoined')
    || point.toLowerCase().includes('removed by doctor')
  );

  if (hasSimilarPoint) {
    return keyPoints;
  }

  return [...keyPoints, timelineKeyPoint];
}

function serializePresenceTimelineForSummary(
  timeline: PresenceTimeline | null
): Array<{ eventType: PresenceEventType; actorType: string; eventAt: Date; label: string }> {
  if (!timeline) {
    return [];
  }

  return timeline.events.map((event) => ({
    eventType: event.eventType,
    actorType: event.actorType,
    eventAt: event.eventAt,
    label: event.label,
  }));
}

async function loadPresenceTimeline(
  db: any,
  consultationSessionId: string | null | undefined
): Promise<PresenceTimeline | null> {
  if (!consultationSessionId) {
    return null;
  }

  try {
    const eventsRef = db
      .collection('consultationSessions')
      .doc(consultationSessionId)
      .collection('events');

    let snapshot;
    try {
      snapshot = await eventsRef.orderBy('eventAt', 'asc').limit(200).get();
    } catch (orderingError) {
      console.warn('Presence timeline orderBy fallback triggered:', orderingError);
      snapshot = await eventsRef.limit(200).get();
    }

    if (snapshot.empty) {
      return null;
    }

    const events: PresenceTimelineEvent[] = snapshot.docs
      .map((doc: QueryDocumentSnapshot) => {
        const data = doc.data() as {
          eventType?: string;
          actorType?: string;
          eventAt?: unknown;
          createdAt?: unknown;
        };

        const eventType = data.eventType;
        const isSupportedEventType =
          eventType === 'joined'
          || eventType === 'left'
          || eventType === 'rejoined'
          || eventType === 'admitted_to_consultation'
          || eventType === 'patient_removed_by_doctor';
        if (!isSupportedEventType) {
          return null;
        }

        const actorType =
          data.actorType === 'patient' || data.actorType === 'doctor' || data.actorType === 'system'
            ? data.actorType
            : 'unknown';

        // Keep timeline focused on patient presence transitions.
        const isDoctorModerationEvent = eventType === 'patient_removed_by_doctor';
        const isDoctorAdmissionEvent = eventType === 'admitted_to_consultation';
        if (
          actorType !== 'patient'
          && actorType !== 'unknown'
          && !isDoctorModerationEvent
          && !isDoctorAdmissionEvent
        ) {
          return null;
        }

        const eventAt = toDate(data.eventAt) || toDate(data.createdAt);
        if (!eventAt) {
          return null;
        }

        return {
          eventType,
          actorType,
          eventAt,
          label: getPresenceEventLabel(eventType),
        } as PresenceTimelineEvent;
      })
      .filter((event: PresenceTimelineEvent | null): event is PresenceTimelineEvent => Boolean(event))
      .sort(
        (left: PresenceTimelineEvent, right: PresenceTimelineEvent) =>
          left.eventAt.getTime() - right.eventAt.getTime()
      );

    if (events.length === 0) {
      return null;
    }

    const joinedCount = events.filter((event) => event.eventType === 'joined').length;
    const leftCount = events.filter((event) => event.eventType === 'left').length;
    const rejoinCount = events.filter((event) => event.eventType === 'rejoined').length;
    const admittedCount = events.filter((event) => event.eventType === 'admitted_to_consultation').length;
    const removedByDoctorCount = events.filter((event) => event.eventType === 'patient_removed_by_doctor').length;

    const timeline: PresenceTimeline = {
      events,
      joinedCount,
      leftCount,
      rejoinCount,
      admittedCount,
      removedByDoctorCount,
      hadDisconnect: leftCount > 0,
      hadRejoin: rejoinCount > 0,
      promptContext: buildPresenceTimelinePromptContext(events),
      narrative: '',
    };
    timeline.narrative = buildPresenceTimelineNarrative(timeline) || '';

    return timeline;
  } catch (error) {
    console.error('Error loading presence timeline:', error);
    return null;
  }
}

function defaultMetadata(
  userId: string,
  transcriptionData: string[] | null | undefined,
  consultationSessionId: string | null | undefined
) {
  return {
    totalParticipants: 1,
    createdBy: userId,
    consultationSessionId: consultationSessionId || null,
    source: 'consultation_tracking',
    hasTranscriptionData: Boolean(transcriptionData && transcriptionData.length > 0),
    transcriptionEntries: transcriptionData ? transcriptionData.length : 0,
    transcriptionSource: transcriptionData?.length
      ? 'doctor-device-browser-speech-recognition'
      : 'none',
    transcriptionLimitation: transcriptionData?.length
      ? 'Browser speech notes may be incomplete or inaccurate and may not contain every speaker.'
      : 'No speech-note text was available.',
    summaryGeneratedAt: new Date(),
  };
}

function stripMarkdownCodeFence(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('```json')) {
    return trimmed.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  }
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return trimmed;
}

function normalizeSummary(parsedSummary: any): ParsedSummary {
  return {
    summary: parsedSummary.summary || 'Summary generation failed',
    keyPoints: parsedSummary.keyPoints || ['No key points available'],
    recommendations: parsedSummary.recommendations || ['No recommendations available'],
    followUpActions: parsedSummary.followUpActions || ['No follow-up actions specified'],
    riskLevel: parsedSummary.riskLevel || 'Unknown',
    category: parsedSummary.category || 'General Consultation',
  };
}

function buildPrompt(
  roomName: string,
  patientName: string,
  durationMinutes: number,
  transcriptionData: string[] | null,
  attachmentContext: string | null,
  presenceTimelineContext: string | null
): string {
  const conversationContext = transcriptionData && transcriptionData.length > 0
    ? `\n\nDoctor-device browser speech notes (not a complete or authoritative transcript; speaker identity is unverified):\n${transcriptionData.join('\n')}`
    : '\n\nNo speech-note text is available. Do not infer conversation details.';

  const attachmentSummaryContext = attachmentContext
    ? `\n\nExtracted attachment context:\n${attachmentContext}`
    : '\n\nNo extracted attachment text available.';

  const patientPresenceContext = presenceTimelineContext
    ? `\n\nPatient presence timeline events:\n${presenceTimelineContext}`
    : '\n\nNo patient join/leave timeline available.';

  return `You are a medical AI assistant specializing in summarizing telehealth consultations.

Generate a comprehensive, structured summary for a medical consultation that took place in room: ${roomName}.

Consultation details:
- Duration: ${durationMinutes} minutes
- Patient: ${patientName}
${conversationContext}
${attachmentSummaryContext}
${patientPresenceContext}

Please provide the following structured response in JSON format:

{
  "summary": "A concise 2-3 sentence overview of the consultation based on the actual conversation content",
  "keyPoints": ["List of 3-5 main topics discussed", "Important symptoms mentioned", "Key findings from the conversation"],
  "recommendations": ["List of 2-4 recommendations made by the doctor", "Prescriptions if any", "Lifestyle advice"],
  "followUpActions": ["List of 2-3 follow-up actions needed", "Appointment scheduling", "Tests required"],
  "riskLevel": "Low/Medium/High draft signal based only on the supplied text",
  "category": "Primary Care/Specialist/Emergency/Follow-up/General Consultation"
}

IMPORTANT: Base your summary only on the supplied evidence. Never invent diagnoses, medications, symptoms, speaker identities, or recommendations. If speech notes are missing or ambiguous, state that clearly.
This output is a clinician-review draft and must not be presented as a diagnosis or autonomous triage decision.
If the patient left and rejoined, explicitly mention this in both the summary and key points.

Focus on medical accuracy, patient privacy, and actionable insights.`;
}

async function buildAttachmentContext(
  db: any,
  consultationSessionId: string | null | undefined
): Promise<string | null> {
  if (!consultationSessionId) {
    return null;
  }

  try {
    const attachmentDocs = await new AttachmentRepository(db).findReady(consultationSessionId, 20);

    if (attachmentDocs.length === 0) {
      return null;
    }

    const sections = attachmentDocs
      .map((doc: QueryDocumentSnapshot, index: number) => {
        const data = doc.data() as { name?: string; extractedText?: string | null };
        const extractedText = (data.extractedText || '').trim();
        if (!extractedText) {
          return null;
        }

        const safeText = extractedText.slice(0, 3000);
        const attachmentName = data.name || `Attachment ${index + 1}`;
        return `- ${attachmentName}:\n${safeText}`;
      })
      .filter((section: string | null): section is string => Boolean(section));

    if (sections.length === 0) {
      return null;
    }

    return sections.join('\n\n');
  } catch (error) {
    console.error('Error loading extracted attachment context:', error);
    return null;
  }
}

// Returns true when an existing summary document represents finalized content
// that must not be overwritten by a webhook-triggered regeneration:
//   - the doctor has edited it (metadata.isEdited)
//   - a previous AI run already produced a successful summary
//     (metadata.aiSummaryGenerated)
// Fallback / error / gated placeholders intentionally do NOT set
// aiSummaryGenerated, so they remain regeneratable.
async function shouldSkipSummaryRegeneration(
  summaryRepo: CallSummaryRepository,
  summaryDocumentId: string
): Promise<boolean> {
  try {
    const existing = await summaryRepo.getById(summaryDocumentId);
    if (!existing.exists) {
      return false;
    }

    const data = (existing.data() as Record<string, unknown>) || {};
    const metadata = (data.metadata as Record<string, unknown> | undefined) || {};

    if (metadata.isEdited === true) {
      return true;
    }

    if (metadata.aiSummaryGenerated === true) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking existing summary for idempotency:', error);
    return false;
  }
}

function attachPatientFields(
  summaryData: Record<string, any>,
  patientUserId: string | null | undefined,
  patientEmail: string | null | undefined
) {
  if (isKnownUserId(patientUserId)) {
    summaryData.patientUserId = patientUserId;
    summaryData.metadata.patientUserId = patientUserId;
  }

  if (patientEmail) {
    summaryData.patientEmail = patientEmail;
    summaryData.metadata.patientEmail = patientEmail;
  }
}

export async function generateAndStoreConsultationSummary({
  roomName,
  patientName,
  durationMinutes,
  userId,
  consultationSessionId = null,
  transcriptionData = null,
  patientUserId = null,
  patientEmail = null,
}: GenerateConsultationSummaryParams): Promise<void> {
  const db = getFirebaseAdmin();
  if (!db) {
    console.error('Firebase Admin not initialized for summary generation');
    return;
  }

  const summaryRepo = new CallSummaryRepository(db);
  const summaryJobRepo = new SummaryJobRepository(db);
  const summaryDocumentId = consultationSessionId || roomName;
  if (await shouldSkipSummaryRegeneration(summaryRepo, summaryDocumentId)) {
    await summaryJobRepo.markCompleted(summaryDocumentId, 'ready').catch((error) => {
      console.error('Failed to reconcile completed summary job:', error);
    });
    console.log(
      'Skipping summary regeneration; preserved existing finalized summary:',
      summaryDocumentId
    );
    return;
  }

  await summaryJobRepo.markProcessing({
    summaryId: summaryDocumentId,
    consultationSessionId: consultationSessionId || roomName,
    doctorUserId: userId,
  }).catch((error) => {
    console.error('Failed to persist summary processing job:', error);
  });

  // Fall back to stored transcript text when the caller did not pass one, so
  // every finalization path (client leave, webhook, history rebuild) produces a
  // transcript-grounded summary rather than the "no transcript available" path.
  const resolvedTranscription =
    transcriptionData && transcriptionData.length > 0
      ? transcriptionData
      : await new CallRepository(db).getTranscriptLines(roomName);

  let presenceTimeline: PresenceTimeline | null = null;
  let presenceTimelineMetadata = buildPresenceTimelineMetadata(null);
  let serializedPresenceTimeline = serializePresenceTimelineForSummary(null);
  let presenceTimelineNarrativeSuffix = '';

  try {
    console.log('Generating AI summary for consultation:', roomName, 'with user ID:', userId);
    presenceTimeline = await loadPresenceTimeline(db, consultationSessionId);
    presenceTimelineMetadata = buildPresenceTimelineMetadata(presenceTimeline);
    serializedPresenceTimeline = serializePresenceTimelineForSummary(presenceTimeline);
    presenceTimelineNarrativeSuffix = presenceTimeline?.narrative
      ? ` ${presenceTimeline.narrative}`
      : '';

    const entitlement = await resolveAiEntitlement(db, userId, 'consultation_summary');
    if (!entitlement.enabled) {
      const summaryData: Record<string, any> = {
        roomName,
        consultationSessionId,
        summary:
          `Consultation completed. AI summary is currently unavailable for this account configuration.${presenceTimelineNarrativeSuffix}`,
        keyPoints: augmentKeyPointsWithPresenceTimeline(
          ['Consultation completed', 'AI summary not available for current configuration'],
          presenceTimeline
        ),
        recommendations: ['Review consultation manually', 'Enable AI when needed'],
        followUpActions: ['Document outcomes in notes'],
        riskLevel: 'Unknown',
        category: 'General Consultation',
        participants: [patientName],
        duration: durationMinutes,
        presenceTimeline: serializedPresenceTimeline,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          ...defaultMetadata(userId, resolvedTranscription, consultationSessionId),
          ...presenceTimelineMetadata,
          aiSummaryEnabled: false,
          aiSummaryDisabledReason: entitlement.reason,
          summaryStatus: 'unavailable',
        },
      };

      attachPatientFields(summaryData, patientUserId, patientEmail);
      await summaryRepo.overwrite(summaryDocumentId, summaryData);
      await summaryJobRepo.markCompleted(summaryDocumentId, 'unavailable').catch((error) => {
        console.error('Failed to complete unavailable summary job:', error);
      });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key not configured, using fallback summary');

      const summaryData: Record<string, any> = {
        roomName,
        consultationSessionId,
        summary: `Consultation completed with ${patientName}. Duration: ${durationMinutes} minutes. No AI analysis available - OpenAI not configured.${presenceTimelineNarrativeSuffix}`,
        keyPoints: augmentKeyPointsWithPresenceTimeline(
          ['Consultation completed', 'Duration recorded', 'No AI analysis available'],
          presenceTimeline
        ),
        recommendations: ['Please configure OpenAI API for enhanced summaries'],
        followUpActions: ['Manual review required'],
        riskLevel: 'Unknown',
        category: 'General Consultation',
        participants: [patientName],
        duration: durationMinutes,
        presenceTimeline: serializedPresenceTimeline,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          ...defaultMetadata(userId, resolvedTranscription, consultationSessionId),
          ...presenceTimelineMetadata,
          aiSummaryEnabled: false,
          aiSummaryDisabledReason: 'OPENAI_API_KEY not configured',
          summaryStatus: 'unavailable',
        },
      };

      attachPatientFields(summaryData, patientUserId, patientEmail);

      await summaryRepo.overwrite(summaryDocumentId, summaryData);
      await summaryJobRepo.markCompleted(summaryDocumentId, 'unavailable').catch((error) => {
        console.error('Failed to complete unavailable summary job:', error);
      });
      console.log('Fallback summary stored successfully with user ID:', userId);
      return;
    }

    const attachmentContext = await buildAttachmentContext(db, consultationSessionId);
    const prompt = buildPrompt(
      roomName,
      patientName,
      durationMinutes,
      resolvedTranscription,
      attachmentContext,
      presenceTimeline?.promptContext || null
    );

    const processingSummary: Record<string, any> = {
      roomName,
      consultationSessionId,
      summary: '',
      keyPoints: [],
      recommendations: [],
      followUpActions: [],
      riskLevel: 'Pending',
      category: 'General Consultation',
      participants: [patientName],
      duration: durationMinutes,
      presenceTimeline: serializedPresenceTimeline,
      createdAt: new Date(),
      createdBy: userId,
      metadata: {
        ...defaultMetadata(userId, resolvedTranscription, consultationSessionId),
        ...presenceTimelineMetadata,
        hasAttachmentContext: Boolean(attachmentContext),
        summaryStatus: 'processing',
        summaryAttemptedAt: new Date(),
      },
    };
    attachPatientFields(processingSummary, patientUserId, patientEmail);
    await summaryRepo.overwrite(summaryDocumentId, processingSummary);

    const response = await requestOpenAiCompletion(
      JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a medical AI assistant that provides structured, professional summaries of telehealth consultations. Always respond with valid JSON format.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 800,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      })
    );

    if (!response.ok) {
      console.error('OpenAI API request failed with status:', response.status);
      throw new Error(`OpenAI API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';
    try {
      const parsedSummary = normalizeSummary(JSON.parse(stripMarkdownCodeFence(content)));
      parsedSummary.keyPoints = augmentKeyPointsWithPresenceTimeline(
        parsedSummary.keyPoints,
        presenceTimeline
      );
      console.log('Successfully parsed AI response');

      const summaryData: Record<string, any> = {
        roomName,
        consultationSessionId,
        summary: parsedSummary.summary,
        keyPoints: parsedSummary.keyPoints,
        recommendations: parsedSummary.recommendations,
        followUpActions: parsedSummary.followUpActions,
        riskLevel: parsedSummary.riskLevel,
        category: parsedSummary.category,
        participants: [patientName],
        duration: durationMinutes,
        presenceTimeline: serializedPresenceTimeline,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          ...defaultMetadata(userId, resolvedTranscription, consultationSessionId),
          ...presenceTimelineMetadata,
          hasAttachmentContext: Boolean(attachmentContext),
          // Marks this document as a real, successful AI generation so that
          // shouldSkipSummaryRegeneration preserves it on webhook replays.
          aiSummaryGenerated: true,
          summaryStatus: 'ready',
          requiresClinicianReview: true,
        },
      };

      attachPatientFields(summaryData, patientUserId, patientEmail);

      await summaryRepo.overwrite(summaryDocumentId, summaryData);
      await summaryJobRepo.markCompleted(summaryDocumentId, 'ready').catch((error) => {
        console.error('Failed to complete ready summary job:', error);
      });
      console.log('AI summary stored successfully in Firestore with user ID:', userId);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);

      const summaryData = {
        roomName,
        consultationSessionId,
        summary: `AI summary generation returned an invalid response. Manual review is required.${presenceTimelineNarrativeSuffix}`,
        keyPoints: augmentKeyPointsWithPresenceTimeline(
          ['Unable to parse structured data'],
          presenceTimeline
        ),
        recommendations: ['Manual review recommended'],
        followUpActions: ['Contact support if needed'],
        riskLevel: 'Unknown',
        category: 'General Consultation',
        participants: [patientName],
        duration: durationMinutes,
        presenceTimeline: serializedPresenceTimeline,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          ...defaultMetadata(userId, resolvedTranscription, consultationSessionId),
          ...presenceTimelineMetadata,
          summaryStatus: 'failed',
          requiresClinicianReview: true,
          failureCode: 'invalid_model_response',
        },
      };

      attachPatientFields(summaryData, patientUserId, patientEmail);
      await summaryRepo.overwrite(summaryDocumentId, summaryData);
      await summaryJobRepo.markFailed(summaryDocumentId, 'invalid_model_response').catch((error) => {
        console.error('Failed to persist invalid-response retry state:', error);
      });
      console.log('Parse error fallback summary stored successfully with user ID:', userId);
    }
  } catch (error) {
    console.error('Error generating consultation summary:', error);

    try {
      const summaryData = {
        roomName,
        consultationSessionId,
        summary: `Error generating AI summary.${presenceTimelineNarrativeSuffix}`,
        keyPoints: augmentKeyPointsWithPresenceTimeline(['Summary generation failed'], presenceTimeline),
        recommendations: ['Manual review required'],
        followUpActions: ['Contact technical support'],
        riskLevel: 'Unknown',
        category: 'General Consultation',
        participants: [patientName],
        duration: durationMinutes,
        presenceTimeline: serializedPresenceTimeline,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          ...defaultMetadata(userId, resolvedTranscription, consultationSessionId),
          ...presenceTimelineMetadata,
          summaryStatus: 'failed',
          requiresClinicianReview: true,
          failureCode: 'generation_failed',
        },
      };

      attachPatientFields(summaryData, patientUserId, patientEmail);
      await summaryRepo.overwrite(summaryDocumentId, summaryData);
      await summaryJobRepo.markFailed(summaryDocumentId, 'generation_failed').catch((jobError) => {
        console.error('Failed to persist generation retry state:', jobError);
      });
      console.log('Error summary stored successfully with user ID:', userId);
    } catch (storeError) {
      console.error('Error storing error summary:', storeError);
      await summaryJobRepo.markFailed(summaryDocumentId, 'summary_persistence_failed').catch(
        (jobError) => {
          console.error('Error persisting summary retry state:', jobError);
        }
      );
    }
  }
}

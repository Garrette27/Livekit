import { getFirebaseAdmin } from '../firebase-admin';
import { isKnownUserId } from './identity-utils';
import { resolveAiEntitlement } from '../ai/ai-entitlement-policy';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

export interface GenerateConsultationSummaryParams {
  roomName: string;
  patientName: string;
  durationMinutes: number;
  userId: string;
  consultationSessionId?: string | null;
  transcriptionData?: any[] | null;
  patientUserId?: string | null;
  patientEmail?: string | null;
}

interface ParsedSummary {
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  followUpActions: string[];
  riskLevel: string;
  category: string;
}

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

function defaultMetadata(
  userId: string,
  transcriptionData: any[] | null | undefined,
  consultationSessionId: string | null | undefined
) {
  return {
    totalParticipants: 1,
    createdBy: userId,
    consultationSessionId: consultationSessionId || null,
    source: 'consultation_tracking',
    hasTranscriptionData: Boolean(transcriptionData && transcriptionData.length > 0),
    transcriptionEntries: transcriptionData ? transcriptionData.length : 0,
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
  transcriptionData: any[] | null,
  attachmentContext: string | null
): string {
  const conversationContext = transcriptionData && transcriptionData.length > 0
    ? `\n\nActual conversation transcript:\n${transcriptionData.join('\n')}`
    : '\n\nNo conversation transcript available. This may be a video-only consultation or transcription was not enabled.';

  const attachmentSummaryContext = attachmentContext
    ? `\n\nExtracted attachment context:\n${attachmentContext}`
    : '\n\nNo extracted attachment text available.';

  return `You are a medical AI assistant specializing in summarizing telehealth consultations. 
    
Generate a comprehensive, structured summary for a medical consultation that took place in room: ${roomName}.

Consultation details:
- Duration: ${durationMinutes} minutes
- Patient: ${patientName}
${conversationContext}
${attachmentSummaryContext}

Please provide the following structured response in JSON format:

{
  "summary": "A concise 2-3 sentence overview of the consultation based on the actual conversation content",
  "keyPoints": ["List of 3-5 main topics discussed", "Important symptoms mentioned", "Key findings from the conversation"],
  "recommendations": ["List of 2-4 recommendations made by the doctor", "Prescriptions if any", "Lifestyle advice"],
  "followUpActions": ["List of 2-3 follow-up actions needed", "Appointment scheduling", "Tests required"],
  "riskLevel": "Low/Medium/High based on the consultation content",
  "category": "Primary Care/Specialist/Emergency/Follow-up/General Consultation"
}

IMPORTANT: Base your summary on the actual conversation content provided. If no conversation transcript is available, indicate this clearly in the summary.

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
    const snapshot = await db
      .collection('consultationSessions')
      .doc(consultationSessionId)
      .collection('attachments')
      .where('extractionStatus', '==', 'ready')
      .limit(20)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const sections = snapshot.docs
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

async function writeSummary(
  db: any,
  summaryDocumentId: string,
  summaryData: Record<string, any>
): Promise<void> {
  const summaryRef = db.collection('call-summaries').doc(summaryDocumentId);
  await summaryRef.set(summaryData);
}

function attachPatientFields(
  summaryData: Record<string, any>,
  patientUserId: string | null | undefined,
  patientEmail: string | null | undefined,
  logPrefix: string
) {
  if (isKnownUserId(patientUserId)) {
    summaryData.patientUserId = patientUserId;
    summaryData.metadata.patientUserId = patientUserId;
  }

  if (patientEmail) {
    summaryData.patientEmail = patientEmail;
    summaryData.metadata.patientEmail = patientEmail;
    console.log(`${logPrefix} ${patientEmail}`);
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

  try {
    console.log('Generating AI summary for consultation:', roomName, 'with user ID:', userId);

    const entitlement = await resolveAiEntitlement(db, userId, 'consultation_summary');
    if (!entitlement.enabled) {
      const summaryData: Record<string, any> = {
        roomName,
        consultationSessionId,
        summary:
          'Consultation completed. AI summary is currently unavailable for this account configuration.',
        keyPoints: ['Consultation completed', 'AI summary not available for current configuration'],
        recommendations: ['Review consultation manually', 'Enable AI when needed'],
        followUpActions: ['Document outcomes in notes'],
        riskLevel: 'Unknown',
        category: 'General Consultation',
        participants: [patientName],
        duration: durationMinutes,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          ...defaultMetadata(userId, transcriptionData, consultationSessionId),
          aiSummaryEnabled: false,
          aiSummaryDisabledReason: entitlement.reason,
        },
      };

      attachPatientFields(summaryData, patientUserId, patientEmail, 'Storing patient email in gated summary:');
      await writeSummary(db, consultationSessionId || roomName, summaryData);
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key not configured, using fallback summary');

      const summaryData: Record<string, any> = {
        roomName,
        consultationSessionId,
        summary: `Consultation completed with ${patientName}. Duration: ${durationMinutes} minutes. No AI analysis available - OpenAI not configured.`,
        keyPoints: ['Consultation completed', 'Duration recorded', 'No AI analysis available'],
        recommendations: ['Please configure OpenAI API for enhanced summaries'],
        followUpActions: ['Manual review required'],
        riskLevel: 'Unknown',
        category: 'General Consultation',
        participants: [patientName],
        duration: durationMinutes,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          ...defaultMetadata(userId, transcriptionData, consultationSessionId),
          aiSummaryEnabled: false,
          aiSummaryDisabledReason: 'OPENAI_API_KEY not configured',
        },
      };

      attachPatientFields(
        summaryData,
        patientUserId,
        patientEmail,
        'Storing patient email in fallback summary:'
      );

      await writeSummary(db, consultationSessionId || roomName, summaryData);
      console.log('Fallback summary stored successfully with user ID:', userId);
      console.log('Fallback summary data:', { roomName, createdBy: summaryData.createdBy, metadata: summaryData.metadata });
      return;
    }

    console.log('OpenAI API key found, generating AI summary...');

    const attachmentContext = await buildAttachmentContext(db, consultationSessionId);
    const prompt = buildPrompt(
      roomName,
      patientName,
      durationMinutes,
      transcriptionData,
      attachmentContext
    );

    console.log('Calling OpenAI API for consultation summary...');
    const response = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';
    console.log('OpenAI response received:', content);

    try {
      const parsedSummary = normalizeSummary(JSON.parse(stripMarkdownCodeFence(content)));
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
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          ...defaultMetadata(userId, transcriptionData, consultationSessionId),
          hasAttachmentContext: Boolean(attachmentContext),
        },
      };

      attachPatientFields(summaryData, patientUserId, patientEmail, 'Storing patient email in AI summary:');

      await writeSummary(db, consultationSessionId || roomName, summaryData);
      console.log('AI summary stored successfully in Firestore with user ID:', userId);
      console.log('Summary data:', { roomName, createdBy: summaryData.createdBy, metadata: summaryData.metadata });
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);

      const summaryData = {
        roomName,
        consultationSessionId,
        summary: content || 'Summary generation failed',
        keyPoints: ['Unable to parse structured data'],
        recommendations: ['Manual review recommended'],
        followUpActions: ['Contact support if needed'],
        riskLevel: 'Unknown',
        category: 'General Consultation',
        participants: [patientName],
        duration: durationMinutes,
        createdAt: new Date(),
        createdBy: userId,
        metadata: defaultMetadata(userId, transcriptionData, consultationSessionId),
      };

      await writeSummary(db, consultationSessionId || roomName, summaryData);
      console.log('Parse error fallback summary stored successfully with user ID:', userId);
      console.log('Parse error fallback summary data:', { roomName, createdBy: summaryData.createdBy, metadata: summaryData.metadata });
    }
  } catch (error) {
    console.error('Error generating consultation summary:', error);

    try {
      const summaryData = {
        roomName,
        consultationSessionId,
        summary: 'Error generating AI summary',
        keyPoints: ['Summary generation failed'],
        recommendations: ['Manual review required'],
        followUpActions: ['Contact technical support'],
        riskLevel: 'Unknown',
        category: 'General Consultation',
        participants: [patientName],
        duration: durationMinutes,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          ...defaultMetadata(userId, transcriptionData, consultationSessionId),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };

      await writeSummary(db, consultationSessionId || roomName, summaryData);
      console.log('Error summary stored successfully with user ID:', userId);
      console.log('Error summary data:', { roomName, createdBy: summaryData.createdBy, metadata: summaryData.metadata });
    } catch (storeError) {
      console.error('Error storing error summary:', storeError);
    }
  }
}

import { getFirebaseAdmin } from '../firebase-admin';
import { isKnownUserId } from './identity-utils';

export interface GenerateConsultationSummaryParams {
  roomName: string;
  patientName: string;
  durationMinutes: number;
  userId: string;
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

function defaultMetadata(userId: string, transcriptionData: any[] | null | undefined) {
  return {
    totalParticipants: 1,
    createdBy: userId,
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
  transcriptionData: any[] | null
): string {
  const conversationContext = transcriptionData && transcriptionData.length > 0
    ? `\n\nActual conversation transcript:\n${transcriptionData.join('\n')}`
    : '\n\nNo conversation transcript available. This may be a video-only consultation or transcription was not enabled.';

  return `You are a medical AI assistant specializing in summarizing telehealth consultations. 
    
Generate a comprehensive, structured summary for a medical consultation that took place in room: ${roomName}.

Consultation details:
- Duration: ${durationMinutes} minutes
- Patient: ${patientName}
${conversationContext}

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

async function writeSummary(
  db: any,
  roomName: string,
  summaryData: Record<string, any>
): Promise<void> {
  const summaryRef = db.collection('call-summaries').doc(roomName);
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

    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key not configured, using fallback summary');

      const summaryData: Record<string, any> = {
        roomName,
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
        metadata: defaultMetadata(userId, transcriptionData),
      };

      attachPatientFields(
        summaryData,
        patientUserId,
        patientEmail,
        'Storing patient email in fallback summary:'
      );

      await writeSummary(db, roomName, summaryData);
      console.log('Fallback summary stored successfully with user ID:', userId);
      console.log('Fallback summary data:', { roomName, createdBy: summaryData.createdBy, metadata: summaryData.metadata });
      return;
    }

    console.log('OpenAI API key found, generating AI summary...');

    const prompt = buildPrompt(roomName, patientName, durationMinutes, transcriptionData);

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
        metadata: defaultMetadata(userId, transcriptionData),
      };

      attachPatientFields(summaryData, patientUserId, patientEmail, 'Storing patient email in AI summary:');

      await writeSummary(db, roomName, summaryData);
      console.log('AI summary stored successfully in Firestore with user ID:', userId);
      console.log('Summary data:', { roomName, createdBy: summaryData.createdBy, metadata: summaryData.metadata });
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);

      const summaryData = {
        roomName,
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
        metadata: defaultMetadata(userId, transcriptionData),
      };

      await writeSummary(db, roomName, summaryData);
      console.log('Parse error fallback summary stored successfully with user ID:', userId);
      console.log('Parse error fallback summary data:', { roomName, createdBy: summaryData.createdBy, metadata: summaryData.metadata });
    }
  } catch (error) {
    console.error('Error generating consultation summary:', error);

    try {
      const summaryData = {
        roomName,
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
          ...defaultMetadata(userId, transcriptionData),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };

      await writeSummary(db, roomName, summaryData);
      console.log('Error summary stored successfully with user ID:', userId);
      console.log('Error summary data:', { roomName, createdBy: summaryData.createdBy, metadata: summaryData.metadata });
    } catch (storeError) {
      console.error('Error storing error summary:', storeError);
    }
  }
}

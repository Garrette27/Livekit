import { isKnownUserId } from '../consultations/identity-utils';
import { getFirebaseAdmin } from '../firebase-admin';

interface SummaryPayload {
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  followUpActions: string[];
  riskLevel: string;
  category: string;
}

interface EventRoomDetails {
  roomName: string;
  participants: any[];
  participantNames: string[];
  duration: number;
}

interface ConsultationContext {
  transcriptionData: any[] | null;
  createdBy: string;
  patientUserId: string | null;
  consultationDataForSummary: any | null;
}

export interface ProcessRoomEndResult {
  skipped: boolean;
}

export function isRoomEndEvent(event: any): boolean {
  return event?.event === 'room_finished' || event?.event === 'participant_left';
}

function getRoomDetails(event: any): EventRoomDetails | null {
  const roomName = event?.room?.name;
  if (!roomName) {
    return null;
  }

  const participants = event?.room?.participants || [];
  const participantNames = participants.map((participant: any) => participant.identity || participant.name || 'Unknown');
  const duration = event?.room?.duration || 0;

  return {
    roomName,
    participants,
    participantNames,
    duration,
  };
}

async function summaryAlreadyExists(db: any, roomName: string): Promise<boolean> {
  if (!db) {
    return false;
  }

  try {
    const existing = await db.collection('call-summaries').doc(roomName).get();
    if (existing.exists) {
      console.log('Summary already exists for room, skipping duplicate generation:', roomName);
      return true;
    }
  } catch (error) {
    console.log('Idempotency check failed (continuing):', error);
  }

  return false;
}

async function loadConsultationContext(db: any, roomName: string): Promise<ConsultationContext> {
  const context: ConsultationContext = {
    transcriptionData: null,
    createdBy: 'unknown',
    patientUserId: null,
    consultationDataForSummary: null,
  };

  if (!db) {
    return context;
  }

  try {
    console.log('Fetching transcription data from Firestore...');
    const callRef = db.collection('calls').doc(roomName);
    const callDoc = await callRef.get();

    if (callDoc.exists) {
      const callData = callDoc.data();
      context.transcriptionData = callData?.transcription || [];
      context.createdBy = callData?.createdBy || callData?.metadata?.createdBy || 'unknown';
      const transcriptionEntries = context.transcriptionData || [];
      console.log('Transcription data found:', transcriptionEntries.length, 'entries');
      console.log('Call created by:', context.createdBy);
      console.log('Transcription entries:', transcriptionEntries);

      if (transcriptionEntries.length > 0) {
        console.log('First transcription entry:', transcriptionEntries[0]);
        console.log('Last transcription entry:', transcriptionEntries[transcriptionEntries.length - 1]);
      } else {
        console.log('No transcription entries found in call data');
      }
    } else {
      console.log('No call document found in Firestore for room:', roomName);
    }

    if (context.createdBy === 'unknown') {
      try {
        const roomDoc = await db.collection('rooms').doc(roomName).get();
        const roomData = roomDoc.exists ? roomDoc.data() : undefined;
        const consultationDoc = await db.collection('consultations').doc(roomName).get();
        const consultationData = consultationDoc.exists ? consultationDoc.data() : undefined;

        context.createdBy = roomData?.createdBy
          || roomData?.metadata?.createdBy
          || consultationData?.createdBy
          || consultationData?.metadata?.createdBy
          || consultationData?.metadata?.doctorUserId
          || 'unknown';
        context.patientUserId = consultationData?.patientUserId
          || consultationData?.metadata?.patientUserId
          || null;
        console.log('createdBy resolved from rooms/consultations:', context.createdBy);
        console.log('patientUserId from consultation:', context.patientUserId);
      } catch (lookupErr) {
        console.log('Lookup rooms/consultations failed:', lookupErr);
      }
    } else {
      try {
        const consultationDoc = await db.collection('consultations').doc(roomName).get();
        if (consultationDoc.exists) {
          const consultationData = consultationDoc.data();
          context.patientUserId = consultationData?.patientUserId
            || consultationData?.metadata?.patientUserId
            || null;
          console.log('patientUserId from consultation:', context.patientUserId);
        }
      } catch (lookupErr) {
        console.log('Lookup consultation for patientUserId failed:', lookupErr);
      }
    }
  } catch (error) {
    console.error('Error fetching transcription data:', error);
  }

  try {
    const consultationDoc = await db.collection('consultations').doc(roomName).get();
    if (consultationDoc.exists) {
      context.consultationDataForSummary = consultationDoc.data();
      const latestPatientUserId = context.consultationDataForSummary?.patientUserId
        || context.consultationDataForSummary?.metadata?.patientUserId
        || null;

      if (isKnownUserId(latestPatientUserId)) {
        context.patientUserId = latestPatientUserId;
        console.log('Updated patientUserId from consultation (latest check):', context.patientUserId);
      } else if (isKnownUserId(context.patientUserId)) {
        console.log('Using patientUserId from earlier check:', context.patientUserId);
      } else {
        console.log('No valid patientUserId found in consultation');
      }
    }
  } catch (error) {
    console.error('Error re-checking consultation for patientUserId:', error);
  }

  return context;
}

async function resolvePatientEmail(db: any, patientUserId: string, consultationDataForSummary: any): Promise<string | null> {
  if (consultationDataForSummary?.patientEmail || consultationDataForSummary?.metadata?.patientEmail) {
    const patientEmail = consultationDataForSummary.patientEmail || consultationDataForSummary.metadata?.patientEmail;
    console.log('Found patient email in consultation:', patientEmail);
    return patientEmail;
  }

  try {
    const userDoc = await db.collection('users').doc(patientUserId).get();
    if (userDoc.exists) {
      const patientEmail = userDoc.data()?.email || null;
      console.log('Found patient email in user document:', patientEmail);
      return patientEmail;
    }

    console.log('Patient user document not found for userId:', patientUserId);
  } catch (error) {
    console.error('Error fetching patient email for summary:', error);
  }

  return null;
}

async function storeSummary(
  db: any,
  event: any,
  details: EventRoomDetails,
  context: ConsultationContext,
  summary: SummaryPayload
): Promise<void> {
  if (!db) {
    console.error('Firebase Admin not initialized, cannot store summary');
    console.log('Environment variables check:');
    console.log('- FIREBASE_PROJECT_ID:', !!process.env.FIREBASE_PROJECT_ID);
    console.log('- FIREBASE_CLIENT_EMAIL:', !!process.env.FIREBASE_CLIENT_EMAIL);
    console.log('- FIREBASE_PRIVATE_KEY:', !!process.env.FIREBASE_PRIVATE_KEY);
    return;
  }

  console.log('Firebase Admin initialized, storing summary...');
  const summaryRef = db.collection('call-summaries').doc(details.roomName);

  const summaryDataToStore: any = {
    roomName: details.roomName,
    summary: summary.summary,
    keyPoints: summary.keyPoints,
    recommendations: summary.recommendations,
    followUpActions: summary.followUpActions,
    riskLevel: summary.riskLevel,
    category: summary.category,
    participants: details.participantNames,
    duration: details.duration,
    createdAt: new Date(),
    callCreatedAt: new Date(),
    transcriptionData: context.transcriptionData,
    hasTranscriptionData: !!context.transcriptionData && context.transcriptionData.length > 0,
    createdBy: context.createdBy,
    metadata: {
      totalParticipants: details.participants.length,
      recordingUrl: event?.room?.recording_url || event?.room?.recordingUrl || null,
      transcriptionUrl: event?.room?.transcription_url || event?.room?.transcriptionUrl || null,
      source: 'livekit_webhook',
      roomSid: event?.room?.sid || null,
      creationTime: event?.room?.creation_time || null,
      hasTranscriptionData: !!context.transcriptionData && context.transcriptionData.length > 0,
      callCreatedAt: new Date(),
    },
  };

  if (isKnownUserId(context.patientUserId)) {
    summaryDataToStore.patientUserId = context.patientUserId;
    summaryDataToStore.metadata.patientUserId = context.patientUserId;

    const patientEmail = await resolvePatientEmail(db, context.patientUserId, context.consultationDataForSummary);
    if (patientEmail) {
      summaryDataToStore.patientEmail = patientEmail;
      summaryDataToStore.metadata.patientEmail = patientEmail;
      console.log('Storing patient email in summary:', patientEmail);
    } else {
      console.log('No patient email found to store in summary');
    }

    console.log('Storing summary with patientUserId:', context.patientUserId);
  } else {
    console.log('Storing summary without patientUserId (not found or invalid)');
  }

  await summaryRef.set(summaryDataToStore);
  console.log('Summary stored successfully in Firestore');
}

async function deleteCallRecord(db: any, roomName: string): Promise<void> {
  try {
    if (!db) {
      console.log('Firebase not initialized, skipping call record deletion');
      return;
    }

    const callRef = db.collection('calls').doc(roomName);
    await callRef.delete();
    console.log(`Deleted call record for room: ${roomName}`);
  } catch (error) {
    console.error('Error deleting call record:', error);
  }
}

async function scheduleSummaryDeletion(db: any, roomName: string): Promise<void> {
  try {
    if (!db) {
      return;
    }

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    const deletionRef = db.collection('scheduled-deletions').doc(roomName);
    await deletionRef.set({
      roomName,
      summaryId: roomName,
      scheduledFor: deletionDate,
      createdAt: new Date(),
      reason: 'HIPAA compliance - automatic deletion after 30 days',
    });

    console.log(`Scheduled automatic deletion for room: ${roomName} on ${deletionDate}`);
  } catch (error) {
    console.error('Error scheduling automatic deletion:', error);
  }
}

async function generateComprehensiveSummary(
  roomName: string,
  participants: any[],
  duration: number,
  transcriptionData: any[] | null
): Promise<SummaryPayload> {
  try {
    console.log('Starting AI summary generation for room:', roomName);

    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key not configured, using fallback summary');
      return {
        summary: 'AI summary not available - OpenAI not configured',
        keyPoints: ['No AI analysis available'],
        recommendations: ['Please configure OpenAI API for enhanced summaries'],
        followUpActions: ['Manual review required'],
        riskLevel: 'Unknown',
        category: 'General Consultation',
      };
    }

    console.log('OpenAI API key found, generating AI summary...');

    let conversationContext = '';
    if (transcriptionData && transcriptionData.length > 0) {
      console.log('Preparing conversation context for AI with', transcriptionData.length, 'entries');
      conversationContext = `\n\nActual conversation transcript:\n${transcriptionData.join('\n')}`;
      console.log('Conversation context length:', conversationContext.length, 'characters');
    } else {
      console.log('No transcription data available, using fallback context');
      conversationContext = '\n\nNo conversation transcript available. This may be a test call or the transcription feature was not enabled.';
    }

    const prompt = `You are a medical AI assistant specializing in summarizing telehealth consultations. 
    
    Generate a comprehensive, structured summary for a medical consultation that took place in room: ${roomName}.
    
    Consultation details:
    - Duration: ${duration} seconds (${Math.round(duration / 60)} minutes)
    - Participants: ${participants.join(', ')}
    ${conversationContext}
    
    Please provide the following structured response in JSON format:
    
    {
      "summary": "A concise 2-3 sentence overview of the consultation based on the actual conversation",
      "keyPoints": ["List of 3-5 main topics discussed", "Important symptoms mentioned", "Key findings from the conversation"],
      "recommendations": ["List of 2-4 recommendations made by the doctor", "Prescriptions if any", "Lifestyle advice"],
      "followUpActions": ["List of 2-3 follow-up actions needed", "Appointment scheduling", "Tests required"],
      "riskLevel": "Low/Medium/High based on the consultation content",
      "category": "Primary Care/Specialist/Emergency/Follow-up/General Consultation"
    }
    
    IMPORTANT: Base your summary on the actual conversation content provided. If no conversation transcript is available, indicate this clearly in the summary.
    
    Focus on medical accuracy, patient privacy, and actionable insights. 
    If this appears to be a medical consultation, prioritize clinical relevance.
    If this appears to be a non-medical call or test call, provide appropriate general consultation summary.`;

    console.log('Calling OpenAI API with conversation context...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a medical AI assistant that provides structured, professional summaries of telehealth consultations. Always respond with valid JSON format. Base your analysis on the actual conversation content provided.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 1000,
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
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsedSummary = JSON.parse(cleanContent);
      console.log('Successfully parsed AI response');

      return {
        summary: parsedSummary.summary || 'Summary generation failed',
        keyPoints: parsedSummary.keyPoints || ['No key points available'],
        recommendations: parsedSummary.recommendations || ['No recommendations available'],
        followUpActions: parsedSummary.followUpActions || ['No follow-up actions specified'],
        riskLevel: parsedSummary.riskLevel || 'Unknown',
        category: parsedSummary.category || 'General Consultation',
      };
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      return {
        summary: content || 'Summary generation failed',
        keyPoints: ['Unable to parse structured data'],
        recommendations: ['Manual review recommended'],
        followUpActions: ['Contact support if needed'],
        riskLevel: 'Unknown',
        category: 'General Consultation',
      };
    }
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return {
      summary: 'Error generating AI summary',
      keyPoints: ['Summary generation failed'],
      recommendations: ['Manual review required'],
      followUpActions: ['Contact technical support'],
      riskLevel: 'Unknown',
      category: 'General Consultation',
    };
  }
}

export async function processRoomEndEvent(event: any): Promise<ProcessRoomEndResult> {
  const details = getRoomDetails(event);
  if (!details) {
    return { skipped: false };
  }

  console.log(`Room ${details.roomName} ended, processing...`);

  const db = getFirebaseAdmin();
  if (await summaryAlreadyExists(db, details.roomName)) {
    return { skipped: true };
  }

  console.log('Room details:', {
    roomName: details.roomName,
    participants: details.participantNames,
    duration: details.duration,
    totalParticipants: details.participants.length,
  });

  const context = await loadConsultationContext(db, details.roomName);

  try {
    console.log('Starting AI summary generation with transcription data...');
    console.log('Transcription data length:', context.transcriptionData ? context.transcriptionData.length : 0);

    if (context.transcriptionData && context.transcriptionData.length > 0) {
      console.log('Transcription data available for AI processing:');
      console.log('Total entries:', context.transcriptionData.length);
      console.log('Sample entries:', context.transcriptionData.slice(0, 3));
    } else {
      console.log('No transcription data available for AI processing');
    }

    const summary = await generateComprehensiveSummary(
      details.roomName,
      details.participants,
      details.duration,
      context.transcriptionData
    );
    console.log('AI summary generated successfully');

    await storeSummary(db, event, details, context, summary);
  } catch (error) {
    console.error('Error generating comprehensive AI summary:', error);
  }

  await deleteCallRecord(db, details.roomName);
  await scheduleSummaryDeletion(db, details.roomName);

  return { skipped: false };
}

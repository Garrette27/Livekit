import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';
import { withRateLimit, RateLimitConfigs } from '../../../lib/rate-limit';
import crypto from 'crypto';

/**
 * Verify webhook signature to ensure request authenticity
 */
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    return false;
  }
  
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = withRateLimit(RateLimitConfigs.WEBHOOK)(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get('x-livekit-signature') || req.headers.get('x-signature');
    const webhookSecret = process.env.LIVEKIT_WEBHOOK_SECRET;
    
    let event;
    
    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      if (!verifyWebhookSignature(body, signature, webhookSecret)) {
        console.error('Invalid webhook signature');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      console.log('Webhook signature verified successfully');
    } else {
      // If no secret is configured, log a warning but continue (for development)
      if (!webhookSecret) {
        console.warn('LIVEKIT_WEBHOOK_SECRET not configured - webhook signature verification disabled');
      }
    }
    
    // Parse the body
    try {
      event = JSON.parse(body);
      console.log('Webhook received:', JSON.stringify(event, null, 2));
    } catch (error) {
      console.error('Invalid JSON in webhook body:', error);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (event.event === 'room_finished' || event.event === 'participant_left') {
      console.log(event.event === 'participant_left' ? '✅ Processing participant_left event (early summary mode)' : '✅ Processing room_finished event');
      const roomName = event.room?.name;
      console.log(`Room ${roomName} ended, processing...`);

      if (roomName) {
        // Idempotency: skip if we already have a summary for this room
        try {
          const db = getFirebaseAdmin();
          if (db) {
            const existing = await db.collection('call-summaries').doc(roomName).get();
            if (existing.exists) {
              console.log('ℹ️ Summary already exists for room, skipping duplicate generation:', roomName);
              return NextResponse.json({ success: true, skipped: true });
            }
          }
        } catch (e) {
          console.log('Idempotency check failed (continuing):', e);
        }
        // Extract participant information from LiveKit format
        const participants = event.room?.participants || [];
        const participantNames = participants.map((p: any) => p.identity || p.name || 'Unknown');
        const duration = event.room?.duration || 0;
        
        console.log('Room details:', {
          roomName,
          participants: participantNames,
          duration,
          totalParticipants: participants.length
        });

        // 1. Fetch transcription data and call metadata from Firestore first
        let transcriptionData = null;
        let createdBy = 'unknown';
        let patientUserId: string | null = null;
        try {
          const db = getFirebaseAdmin();
          if (db) {
            console.log('Fetching transcription data from Firestore...');
            const callRef = db.collection('calls').doc(roomName);
            const callDoc = await callRef.get();
            
            if (callDoc.exists) {
              const callData = callDoc.data();
              transcriptionData = callData?.transcription || [];
              createdBy = callData?.createdBy || callData?.metadata?.createdBy || 'unknown';
              console.log('✅ Transcription data found:', transcriptionData.length, 'entries');
              console.log('✅ Call created by:', createdBy);
              console.log('✅ Transcription entries:', transcriptionData);
              
              // Debug: Log the actual transcription content
              if (transcriptionData && transcriptionData.length > 0) {
                console.log('✅ First transcription entry:', transcriptionData[0]);
                console.log('✅ Last transcription entry:', transcriptionData[transcriptionData.length - 1]);
              } else {
                console.log('⚠️ No transcription entries found in call data');
              }
            } else {
              console.log('❌ No call document found in Firestore for room:', roomName);
            }
            // Fallbacks for createdBy from rooms/consultations if still unknown
            if (createdBy === 'unknown') {
              try {
                const roomDoc = await db.collection('rooms').doc(roomName).get();
                const roomData = roomDoc.exists ? roomDoc.data() : undefined;
                const consultationDoc = await db.collection('consultations').doc(roomName).get();
                const consultationData = consultationDoc.exists ? consultationDoc.data() : undefined;
                createdBy = roomData?.createdBy
                  || roomData?.metadata?.createdBy
                  || consultationData?.createdBy
                  || consultationData?.metadata?.createdBy
                  || consultationData?.metadata?.doctorUserId
                  || 'unknown';
                // Also get patientUserId from consultation for storing in summary
                patientUserId = consultationData?.patientUserId 
                  || consultationData?.metadata?.patientUserId 
                  || null;
                console.log('createdBy resolved from rooms/consultations:', createdBy);
                console.log('patientUserId from consultation:', patientUserId);
              } catch (lookupErr) {
                console.log('Lookup rooms/consultations failed:', lookupErr);
              }
            } else {
              // Even if createdBy is known, try to get patientUserId from consultation
              try {
                const consultationDoc = await db.collection('consultations').doc(roomName).get();
                if (consultationDoc.exists) {
                  const consultationData = consultationDoc.data();
                  patientUserId = consultationData?.patientUserId 
                    || consultationData?.metadata?.patientUserId 
                    || null;
                  console.log('patientUserId from consultation:', patientUserId);
                }
              } catch (lookupErr) {
                console.log('Lookup consultation for patientUserId failed:', lookupErr);
              }
            }
          }
        } catch (error) {
          console.error('❌ Error fetching transcription data:', error);
        }

        // 2. Generate comprehensive AI summary using actual conversation data
        try {
          console.log('Starting AI summary generation with transcription data...');
          console.log('Transcription data length:', transcriptionData ? transcriptionData.length : 0);
          
          // Debug: Log transcription data details
          if (transcriptionData && transcriptionData.length > 0) {
            console.log('✅ Transcription data available for AI processing:');
            console.log('✅ Total entries:', transcriptionData.length);
            console.log('✅ Sample entries:', transcriptionData.slice(0, 3));
          } else {
            console.log('⚠️ No transcription data available for AI processing');
          }
          
          const summary = await generateComprehensiveSummary(roomName, participants, duration, transcriptionData);
          console.log('✅ AI summary generated successfully');
          
                     // Store the summary in Firestore
           const summaryData = {
             roomName,
             summary: summary.summary,
             keyPoints: summary.keyPoints,
             recommendations: summary.recommendations,
             followUpActions: summary.followUpActions,
             riskLevel: summary.riskLevel,
             category: summary.category,
             participants: participants.length,
             duration: Math.round(duration / 60), // Convert to minutes
             createdAt: new Date(),
             callCreatedAt: new Date(), // Add call creation timestamp
             transcriptionData: transcriptionData,
             hasTranscriptionData: transcriptionData && transcriptionData.length > 0,
             metadata: {
               participants: participants.length,
               duration: Math.round(duration / 60),
               transcriptionEntries: transcriptionData ? transcriptionData.length : 0,
               hasTranscriptionData: transcriptionData && transcriptionData.length > 0,
               callCreatedAt: new Date(), // Add call creation timestamp
               summaryGeneratedAt: new Date()
             }
           };

          // Store detailed summary in Firestore
          const db = getFirebaseAdmin();
          if (db) {
            console.log('Firebase Admin initialized, storing summary...');
            const summaryRef = db.collection('call-summaries').doc(roomName);
                          await summaryRef.set({
                ...summaryData,
                createdAt: new Date(),
                createdBy: createdBy, // Store user ID from call data
                patientUserId: patientUserId || undefined, // Store patient user ID if available
                participants: participantNames,
                duration: duration,
                transcriptionData: transcriptionData, // Store the actual transcription
                metadata: {
                  totalParticipants: participants.length,
                  recordingUrl: event.room?.recording_url || event.room?.recordingUrl || null,
                  transcriptionUrl: event.room?.transcription_url || event.room?.transcriptionUrl || null,
                  source: 'livekit_webhook',
                  roomSid: event.room?.sid || null,
                  creationTime: event.room?.creation_time || null,
                  hasTranscriptionData: !!transcriptionData && transcriptionData.length > 0,
                  callCreatedAt: new Date(), // Add call creation timestamp
                  patientUserId: patientUserId || undefined // Also store in metadata
                }
              });
            
            console.log('✅ Summary stored successfully in Firestore');
          } else {
            console.error('❌ Firebase Admin not initialized, cannot store summary');
            console.log('Environment variables check:');
            console.log('- FIREBASE_PROJECT_ID:', !!process.env.FIREBASE_PROJECT_ID);
            console.log('- FIREBASE_CLIENT_EMAIL:', !!process.env.FIREBASE_CLIENT_EMAIL);
            console.log('- FIREBASE_PRIVATE_KEY:', !!process.env.FIREBASE_PRIVATE_KEY);
          }
        } catch (error) {
          console.error('❌ Error generating comprehensive AI summary:', error);
        }

        // 3. Delete call record from Firestore for security
        try {
          const db = getFirebaseAdmin();
          if (db) {
            const callRef = db.collection('calls').doc(roomName);
            await callRef.delete();
            console.log(`✅ Deleted call record for room: ${roomName}`);
          } else {
            console.log('⚠️ Firebase not initialized, skipping call record deletion');
          }
        } catch (error) {
          console.error('❌ Error deleting call record:', error);
        }

        // 4. Schedule automatic deletion of summary after 30 days for HIPAA compliance
        try {
          const db = getFirebaseAdmin();
          if (db) {
            const deletionDate = new Date();
            deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now
            
            const deletionRef = db.collection('scheduled-deletions').doc(roomName);
            await deletionRef.set({
              roomName,
              summaryId: roomName,
              scheduledFor: deletionDate,
              createdAt: new Date(),
              reason: 'HIPAA compliance - automatic deletion after 30 days'
            });
            
            console.log(`✅ Scheduled automatic deletion for room: ${roomName} on ${deletionDate}`);
          }
        } catch (error) {
          console.error('❌ Error scheduling automatic deletion:', error);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function generateComprehensiveSummary(roomName: string, participants: any[], duration: number, transcriptionData: any[]): Promise<any> {
  try {
    console.log('Starting AI summary generation for room:', roomName);
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ OpenAI API key not configured, using fallback summary');
      return {
        summary: 'AI summary not available - OpenAI not configured',
        keyPoints: ['No AI analysis available'],
        recommendations: ['Please configure OpenAI API for enhanced summaries'],
        followUpActions: ['Manual review required'],
        riskLevel: 'Unknown',
        category: 'General Consultation'
      };
    }

    console.log('✅ OpenAI API key found, generating AI summary...');

    // Prepare conversation context for AI
    let conversationContext = '';
    if (transcriptionData && transcriptionData.length > 0) {
      console.log('✅ Preparing conversation context for AI with', transcriptionData.length, 'entries');
      conversationContext = `\n\nActual conversation transcript:\n${transcriptionData.join('\n')}`;
      console.log('✅ Conversation context length:', conversationContext.length, 'characters');
    } else {
      console.log('⚠️ No transcription data available, using fallback context');
      conversationContext = '\n\nNo conversation transcript available. This may be a test call or the transcription feature was not enabled.';
    }

    // Create a comprehensive prompt for medical consultation summarization
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
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a medical AI assistant that provides structured, professional summaries of telehealth consultations. Always respond with valid JSON format. Base your analysis on the actual conversation content provided.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3, // Lower temperature for more consistent medical summaries
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';
    console.log('OpenAI response received:', content);
    
    try {
      // Clean the content - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Parse the JSON response
      const parsedSummary = JSON.parse(cleanContent);
      console.log('✅ Successfully parsed AI response');
      
      // Validate and provide fallbacks for missing fields
      return {
        summary: parsedSummary.summary || 'Summary generation failed',
        keyPoints: parsedSummary.keyPoints || ['No key points available'],
        recommendations: parsedSummary.recommendations || ['No recommendations available'],
        followUpActions: parsedSummary.followUpActions || ['No follow-up actions specified'],
        riskLevel: parsedSummary.riskLevel || 'Unknown',
        category: parsedSummary.category || 'General Consultation'
      };
    } catch (parseError) {
      console.error('❌ Error parsing AI response:', parseError);
      return {
        summary: content || 'Summary generation failed',
        keyPoints: ['Unable to parse structured data'],
        recommendations: ['Manual review recommended'],
        followUpActions: ['Contact support if needed'],
        riskLevel: 'Unknown',
        category: 'General Consultation'
      };
    }
  } catch (error) {
    console.error('❌ Error calling OpenAI:', error);
    return {
      summary: 'Error generating AI summary',
      keyPoints: ['Summary generation failed'],
      recommendations: ['Manual review required'],
      followUpActions: ['Contact technical support'],
      riskLevel: 'Unknown',
      category: 'General Consultation'
    };
  }
}

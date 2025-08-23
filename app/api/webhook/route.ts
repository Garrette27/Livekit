import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const event = await req.json();
    console.log('Webhook received:', event);

    if (event.event === 'room_finished') {
      const roomName = event.room?.name;
      console.log(`Room ${roomName} ended, processing...`);

      if (roomName) {
        // 1. Generate comprehensive AI summary first
        try {
          const summaryData = await generateComprehensiveSummary(roomName, event.room);
          
          // Store detailed summary in Firestore
          const db = getFirebaseAdmin();
          if (db) {
            const summaryRef = db.collection('call-summaries').doc(roomName);
            await summaryRef.set({
              roomName,
              ...summaryData,
              createdAt: new Date(),
              participants: event.room?.participants || [],
              duration: event.room?.duration || 0,
              metadata: {
                totalParticipants: event.room?.participants?.length || 0,
                recordingUrl: event.room?.recordingUrl || null,
                transcriptionUrl: event.room?.transcriptionUrl || null,
              }
            });
            
            console.log(`Comprehensive AI summary generated and stored for room: ${roomName}`);
          } else {
            console.log('Firebase not initialized, skipping summary storage');
          }
        } catch (error) {
          console.error('Error generating comprehensive AI summary:', error);
        }

        // 2. Delete call record from Firestore for security
        try {
          const db = getFirebaseAdmin();
          if (db) {
            const callRef = db.collection('calls').doc(roomName);
            await callRef.delete();
            console.log(`Deleted call record for room: ${roomName}`);
          } else {
            console.log('Firebase not initialized, skipping call record deletion');
          }
        } catch (error) {
          console.error('Error deleting call record:', error);
        }

        // 3. Schedule automatic deletion of summary after 30 days for HIPAA compliance
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
            
            console.log(`Scheduled automatic deletion for room: ${roomName} on ${deletionDate}`);
          }
        } catch (error) {
          console.error('Error scheduling automatic deletion:', error);
        }
      }
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

async function generateComprehensiveSummary(roomName: string, roomData: any): Promise<any> {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key not configured, using fallback summary');
      return {
        summary: 'AI summary not available - OpenAI not configured',
        keyPoints: ['No AI analysis available'],
        recommendations: ['Please configure OpenAI API for enhanced summaries'],
        followUpActions: ['Manual review required'],
        riskLevel: 'Unknown',
        category: 'General Consultation'
      };
    }

    // Create a comprehensive prompt for medical consultation summarization
    const prompt = `You are a medical AI assistant specializing in summarizing telehealth consultations. 
    
    Generate a comprehensive, structured summary for a medical consultation that took place in room: ${roomName}.
    
    Please provide the following structured response in JSON format:
    
    {
      "summary": "A concise 2-3 sentence overview of the consultation",
      "keyPoints": ["List of 3-5 main topics discussed", "Important symptoms mentioned", "Key findings"],
      "recommendations": ["List of 2-4 recommendations made by the doctor", "Prescriptions if any", "Lifestyle advice"],
      "followUpActions": ["List of 2-3 follow-up actions needed", "Appointment scheduling", "Tests required"],
      "riskLevel": "Low/Medium/High based on the consultation content",
      "category": "Primary Care/Specialist/Emergency/Follow-up/General Consultation"
    }
    
    Focus on medical accuracy, patient privacy, and actionable insights. 
    If this appears to be a medical consultation, prioritize clinical relevance.
    If this appears to be a non-medical call, provide appropriate general consultation summary.`;

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
            content: 'You are a medical AI assistant that provides structured, professional summaries of telehealth consultations. Always respond with valid JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.3, // Lower temperature for more consistent medical summaries
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';
    
    try {
      // Parse the JSON response
      const parsedSummary = JSON.parse(content);
      
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
      console.error('Error parsing AI response:', parseError);
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
    console.error('Error calling OpenAI:', error);
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

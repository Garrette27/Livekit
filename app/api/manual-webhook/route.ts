import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { roomName } = await req.json();
    console.log('Manual webhook triggered for room:', roomName);

    if (!roomName) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
    }

    // Simulate a room_finished event
    const mockEvent = {
      event: 'room_finished',
      room: {
        name: roomName,
        participants: ['doctor', 'patient'],
        duration: Math.floor(Math.random() * 30) + 5, // Random duration 5-35 minutes
        recordingUrl: null,
        transcriptionUrl: null
      }
    };

    console.log('Processing mock room_finished event:', mockEvent);

    // Generate comprehensive AI summary
    try {
      console.log('Starting AI summary generation...');
      const summaryData = await generateComprehensiveSummary(roomName, mockEvent.room);
      console.log('AI summary generated:', summaryData);
      
      // Store detailed summary in Firestore
      const db = getFirebaseAdmin();
      if (db) {
        console.log('Firebase Admin initialized, storing summary...');
        const summaryRef = db.collection('call-summaries').doc(roomName);
        await summaryRef.set({
          roomName,
          ...summaryData,
          createdAt: new Date(),
          participants: mockEvent.room.participants,
          duration: mockEvent.room.duration,
          metadata: {
            totalParticipants: mockEvent.room.participants.length,
            recordingUrl: mockEvent.room.recordingUrl,
            transcriptionUrl: mockEvent.room.transcriptionUrl,
            source: 'manual_webhook'
          }
        });
        
        console.log(`✅ Manual webhook: AI summary generated and stored for room: ${roomName}`);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Manual webhook processed successfully',
          roomName,
          summary: summaryData
        });
      } else {
        console.error('❌ Firebase Admin not initialized, cannot store summary');
        return NextResponse.json({ 
          error: 'Firebase Admin not initialized',
          message: 'Please check your Firebase environment variables'
        }, { status: 500 });
      }
    } catch (error) {
      console.error('❌ Error generating AI summary:', error);
      return NextResponse.json({ 
        error: 'Failed to generate AI summary',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Manual webhook error:', error);
    return NextResponse.json({ 
      error: 'Manual webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function generateComprehensiveSummary(roomName: string, roomData: any): Promise<any> {
  try {
    console.log('Starting AI summary generation for room:', roomName);
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ OpenAI API key not configured, using fallback summary');
      return {
        summary: 'AI summary not available - OpenAI not configured. This was a manual webhook test.',
        keyPoints: ['Manual webhook test', 'No AI analysis available', 'Test consultation'],
        recommendations: ['Please configure OpenAI API for enhanced summaries', 'Test completed successfully'],
        followUpActions: ['Manual review required', 'Verify webhook functionality'],
        riskLevel: 'Low',
        category: 'Test Consultation'
      };
    }

    console.log('✅ OpenAI API key found, generating AI summary...');

    // Create a comprehensive prompt for medical consultation summarization
    const prompt = `You are a medical AI assistant specializing in summarizing telehealth consultations. 
    
    Generate a comprehensive, structured summary for a medical consultation that took place in room: ${roomName}.
    
    This was a test consultation with a duration of ${roomData.duration} minutes.
    
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
    Since this is a test consultation, provide appropriate test data that would be typical for a medical consultation.`;

    console.log('Calling OpenAI API...');
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
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';
    console.log('OpenAI response received:', content);
    
    try {
      // Parse the JSON response
      const parsedSummary = JSON.parse(content);
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

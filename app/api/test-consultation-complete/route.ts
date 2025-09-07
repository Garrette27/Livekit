import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { roomName, patientName, duration, userId } = await req.json();
    console.log(`Test consultation complete for room: ${roomName}, patient: ${patientName}, duration: ${duration}, user: ${userId}`);

    if (!roomName || !patientName || !duration || !userId) {
      return NextResponse.json({ 
        error: 'Room name, patient name, duration, and user ID are required' 
      }, { status: 400 });
    }

    const db = getFirebaseAdmin();
    if (!db) {
      console.error('❌ Firebase Admin not initialized');
      return NextResponse.json({ 
        error: 'Firebase Admin not initialized',
        message: 'Please check your Firebase environment variables'
      }, { status: 500 });
    }

    // Create a completed consultation record
    const consultationRef = db.collection('consultations').doc(roomName);
    const joinedAt = new Date();
    const leftAt = new Date(joinedAt.getTime() + (parseInt(duration) * 60 * 1000)); // Add duration in milliseconds

    await consultationRef.set({
      roomName,
      patientName,
      joinedAt,
      leftAt,
      duration: parseInt(duration),
      status: 'completed',
      isRealConsultation: true,
      createdBy: userId,
      metadata: {
        source: 'patient_leave',
        durationMinutes: parseInt(duration),
        trackedAt: new Date(),
        createdBy: userId
      }
    });

    console.log(`✅ Test consultation created: ${roomName}, duration: ${duration} minutes, user: ${userId}`);

    // Generate AI summary for the consultation
    try {
      await generateConsultationSummary(roomName, patientName, parseInt(duration), userId);
    } catch (error) {
      console.error('❌ Error generating consultation summary:', error);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Test consultation completed successfully`,
      roomName,
      duration: parseInt(duration),
      patientName,
      userId
    });

  } catch (error) {
    console.error('❌ Test consultation complete error:', error);
    return NextResponse.json({ 
      error: 'Failed to complete test consultation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function generateConsultationSummary(roomName: string, patientName: string, durationMinutes: number, userId: string) {
  try {
    console.log('Generating AI summary for test consultation:', roomName, 'with user ID:', userId);
    
    const db = getFirebaseAdmin();
    if (!db) {
      console.error('❌ Firebase Admin not initialized for summary generation');
      return;
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ OpenAI API key not configured, using fallback summary');
      
      // Store fallback summary
      const summaryData = {
        roomName,
        summary: `Test consultation completed with ${patientName}. Duration: ${durationMinutes} minutes. No AI analysis available - OpenAI not configured.`,
        keyPoints: ['Test consultation completed', 'Duration recorded', 'No AI analysis available'],
        recommendations: ['Please configure OpenAI API for enhanced summaries'],
        followUpActions: ['Manual review required'],
        riskLevel: 'Low',
        category: 'Test Consultation',
        participants: [patientName],
        duration: durationMinutes,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          totalParticipants: 1,
          createdBy: userId,
          source: 'test_consultation_complete',
          hasTranscriptionData: false,
          summaryGeneratedAt: new Date()
        }
      };

      const summaryRef = db.collection('call-summaries').doc(roomName);
      await summaryRef.set(summaryData);
      console.log('✅ Test consultation fallback summary stored successfully with user ID:', userId);
      return;
    }

    console.log('✅ OpenAI API key found, generating AI summary...');

    // Create a comprehensive prompt for medical consultation summarization
    const prompt = `You are a medical AI assistant specializing in summarizing telehealth consultations. 
    
    Generate a comprehensive, structured summary for a TEST consultation that took place in room: ${roomName}.
    
    Consultation details:
    - Duration: ${durationMinutes} minutes
    - Patient: ${patientName}
    - This is a TEST consultation (no actual conversation transcript available)
    
    Please provide the following structured response in JSON format:
    
    {
      "summary": "A concise 2-3 sentence overview of this test consultation. Mention it was a test consultation and the duration.",
      "keyPoints": ["Test consultation completed", "Duration: ${durationMinutes} minutes", "Patient: ${patientName}", "No transcript available"],
      "recommendations": ["Follow up as needed", "Review consultation notes if available"],
      "followUpActions": ["Schedule follow-up if required", "Document consultation outcomes"],
      "riskLevel": "Low (test consultation)",
      "category": "Test Consultation"
    }
    
    IMPORTANT: This is a TEST consultation, so indicate that clearly in the summary.
    
    Focus on medical accuracy, patient privacy, and actionable insights.`;

    console.log('Calling OpenAI API for test consultation summary...');
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
        temperature: 0.3,
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
      
      // Store the summary in Firestore
      const summaryData = {
        roomName,
        summary: parsedSummary.summary || 'Summary generation failed',
        keyPoints: parsedSummary.keyPoints || ['No key points available'],
        recommendations: parsedSummary.recommendations || ['No recommendations available'],
        followUpActions: parsedSummary.followUpActions || ['No follow-up actions specified'],
        riskLevel: parsedSummary.riskLevel || 'Low',
        category: parsedSummary.category || 'Test Consultation',
        participants: [patientName],
        duration: durationMinutes,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          totalParticipants: 1,
          createdBy: userId,
          source: 'test_consultation_complete',
          hasTranscriptionData: false,
          summaryGeneratedAt: new Date()
        }
      };

      const summaryRef = db.collection('call-summaries').doc(roomName);
      await summaryRef.set(summaryData);
      console.log('✅ Test consultation AI summary stored successfully in Firestore with user ID:', userId);
      console.log('Test consultation summary data:', { roomName, createdBy: summaryData.createdBy, metadata: summaryData.metadata });
      
    } catch (parseError) {
      console.error('❌ Error parsing AI response:', parseError);
      
      // Store fallback summary
      const summaryData = {
        roomName,
        summary: content || 'Summary generation failed',
        keyPoints: ['Unable to parse structured data'],
        recommendations: ['Manual review recommended'],
        followUpActions: ['Contact support if needed'],
        riskLevel: 'Low',
        category: 'Test Consultation',
        participants: [patientName],
        duration: durationMinutes,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          totalParticipants: 1,
          createdBy: userId,
          source: 'test_consultation_complete',
          hasTranscriptionData: false,
          summaryGeneratedAt: new Date()
        }
      };

      const summaryRef = db.collection('call-summaries').doc(roomName);
      await summaryRef.set(summaryData);
      console.log('✅ Test consultation parse error fallback summary stored successfully with user ID:', userId);
    }
    
  } catch (error) {
    console.error('❌ Error generating test consultation summary:', error);
    
    // Store error summary
    try {
      const db = getFirebaseAdmin();
      if (db) {
        const summaryData = {
          roomName,
          summary: 'Error generating AI summary',
          keyPoints: ['Summary generation failed'],
          recommendations: ['Manual review required'],
          followUpActions: ['Contact technical support'],
          riskLevel: 'Low',
          category: 'Test Consultation',
          participants: [patientName],
          duration: durationMinutes,
          createdAt: new Date(),
          createdBy: userId,
          metadata: {
            totalParticipants: 1,
            createdBy: userId,
            source: 'test_consultation_complete',
            hasTranscriptionData: false,
            summaryGeneratedAt: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        };

        const summaryRef = db.collection('call-summaries').doc(roomName);
        await summaryRef.set(summaryData);
        console.log('✅ Test consultation error summary stored successfully with user ID:', userId);
      }
    } catch (storeError) {
      console.error('❌ Error storing test consultation error summary:', storeError);
    }
  }
}

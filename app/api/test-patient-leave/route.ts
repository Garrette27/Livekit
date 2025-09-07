import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { roomName, patientName, userId } = await req.json();
    console.log(`Test patient leave for room: ${roomName}, patient: ${patientName}, user: ${userId}`);

    if (!roomName || !patientName) {
      return NextResponse.json({ 
        error: 'Room name and patient name are required' 
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

    // Look up the room creator (doctor) to link the consultation to them
    let doctorUserId = userId || 'unknown';
    try {
      const roomRef = db.collection('rooms').doc(roomName);
      const roomDoc = await roomRef.get();
      if (roomDoc.exists) {
        const roomData = roomDoc.data();
        doctorUserId = roomData?.createdBy || roomData?.metadata?.createdBy || userId || 'unknown';
        console.log(`Found room creator: ${doctorUserId} for room: ${roomName}`);
      } else {
        console.log(`Room ${roomName} not found in rooms collection, using provided userId: ${userId}`);
      }
    } catch (error) {
      console.error('Error looking up room creator:', error);
      console.log(`Using provided userId: ${userId}`);
    }

    // Check if consultation exists
    const consultationRef = db.collection('consultations').doc(roomName);
    const consultationDoc = await consultationRef.get();
    
    if (!consultationDoc.exists) {
      return NextResponse.json({ 
        error: 'Consultation not found',
        message: `No consultation found for room: ${roomName}`
      }, { status: 404 });
    }

    const data = consultationDoc.data();
    const joinedAt = data?.joinedAt?.toDate() || new Date();
    const leftAt = new Date();
    const durationMinutes = Math.round((leftAt.getTime() - joinedAt.getTime()) / (1000 * 60));

    // Update consultation with leave data
    await consultationRef.update({
      leftAt,
      duration: durationMinutes,
      status: 'completed',
      isRealConsultation: true,
      createdBy: doctorUserId,
      metadata: {
        ...data?.metadata,
        source: 'patient_leave',
        durationMinutes,
        trackedAt: new Date(),
        createdBy: doctorUserId,
        patientUserId: userId || 'anonymous'
      }
    });

    console.log(`✅ Patient left consultation: ${roomName}, duration: ${durationMinutes} minutes, linked to doctor: ${doctorUserId}`);

    // Generate AI summary for completed consultation
    try {
      await generateConsultationSummary(roomName, data?.patientName || patientName, durationMinutes, doctorUserId);
    } catch (error) {
      console.error('❌ Error generating consultation summary:', error);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Patient leave tracked successfully`,
      roomName,
      duration: durationMinutes,
      patientName: data?.patientName || patientName,
      doctorUserId
    });

  } catch (error) {
    console.error('❌ Test patient leave error:', error);
    return NextResponse.json({ 
      error: 'Failed to track patient leave',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function generateConsultationSummary(roomName: string, patientName: string, durationMinutes: number, userId: string) {
  try {
    console.log('Generating AI summary for test patient leave:', roomName, 'with user ID:', userId);
    
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
        summary: `Consultation completed with ${patientName}. Duration: ${durationMinutes} minutes. No AI analysis available - OpenAI not configured.`,
        keyPoints: ['Consultation completed', 'Duration recorded', 'No AI analysis available'],
        recommendations: ['Please configure OpenAI API for enhanced summaries'],
        followUpActions: ['Manual review required'],
        riskLevel: 'Low',
        category: 'General Consultation',
        participants: [patientName],
        duration: durationMinutes,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          totalParticipants: 1,
          createdBy: userId,
          source: 'test_patient_leave',
          hasTranscriptionData: false,
          summaryGeneratedAt: new Date()
        }
      };

      const summaryRef = db.collection('call-summaries').doc(roomName);
      await summaryRef.set(summaryData);
      console.log('✅ Test patient leave fallback summary stored successfully with user ID:', userId);
      return;
    }

    console.log('✅ OpenAI API key found, generating AI summary...');

    // Create a comprehensive prompt for medical consultation summarization
    const prompt = `You are a medical AI assistant specializing in summarizing telehealth consultations. 
    
    Generate a comprehensive, structured summary for a consultation that took place in room: ${roomName}.
    
    Consultation details:
    - Duration: ${durationMinutes} minutes
    - Patient: ${patientName}
    - This consultation was completed (patient left the session)
    
    Please provide the following structured response in JSON format:
    
    {
      "summary": "A concise 2-3 sentence overview of this consultation. Mention the duration and that the patient completed the session.",
      "keyPoints": ["Consultation completed", "Duration: ${durationMinutes} minutes", "Patient: ${patientName}", "Session ended normally"],
      "recommendations": ["Follow up as needed", "Review consultation notes if available"],
      "followUpActions": ["Schedule follow-up if required", "Document consultation outcomes"],
      "riskLevel": "Low",
      "category": "General Consultation"
    }
    
    Focus on medical accuracy, patient privacy, and actionable insights.`;

    console.log('Calling OpenAI API for test patient leave summary...');
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
        category: parsedSummary.category || 'General Consultation',
        participants: [patientName],
        duration: durationMinutes,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          totalParticipants: 1,
          createdBy: userId,
          source: 'test_patient_leave',
          hasTranscriptionData: false,
          summaryGeneratedAt: new Date()
        }
      };

      const summaryRef = db.collection('call-summaries').doc(roomName);
      await summaryRef.set(summaryData);
      console.log('✅ Test patient leave AI summary stored successfully in Firestore with user ID:', userId);
      console.log('Test patient leave summary data:', { roomName, createdBy: summaryData.createdBy, metadata: summaryData.metadata });
      
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
        category: 'General Consultation',
        participants: [patientName],
        duration: durationMinutes,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          totalParticipants: 1,
          createdBy: userId,
          source: 'test_patient_leave',
          hasTranscriptionData: false,
          summaryGeneratedAt: new Date()
        }
      };

      const summaryRef = db.collection('call-summaries').doc(roomName);
      await summaryRef.set(summaryData);
      console.log('✅ Test patient leave parse error fallback summary stored successfully with user ID:', userId);
    }
    
  } catch (error) {
    console.error('❌ Error generating test patient leave summary:', error);
    
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
          category: 'General Consultation',
          participants: [patientName],
          duration: durationMinutes,
          createdAt: new Date(),
          createdBy: userId,
          metadata: {
            totalParticipants: 1,
            createdBy: userId,
            source: 'test_patient_leave',
            hasTranscriptionData: false,
            summaryGeneratedAt: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        };

        const summaryRef = db.collection('call-summaries').doc(roomName);
        await summaryRef.set(summaryData);
        console.log('✅ Test patient leave error summary stored successfully with user ID:', userId);
      }
    } catch (storeError) {
      console.error('❌ Error storing test patient leave error summary:', storeError);
    }
  }
}

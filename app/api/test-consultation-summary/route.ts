import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { roomName, patientName, duration, userId } = await req.json();
    console.log(`Test consultation summary for room: ${roomName}, patient: ${patientName}, duration: ${duration}, user: ${userId}`);

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

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ OpenAI API key not configured, using fallback summary');
      
      // Store fallback summary
      const summaryData = {
        roomName,
        summary: `Test consultation completed with ${patientName}. Duration: ${duration} minutes. No AI analysis available - OpenAI not configured.`,
        keyPoints: ['Test consultation completed', 'Duration recorded', 'No AI analysis available'],
        recommendations: ['Please configure OpenAI API for enhanced summaries'],
        followUpActions: ['Manual review required'],
        riskLevel: 'Low',
        category: 'Test Consultation',
        participants: [patientName],
        duration: parseInt(duration),
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          totalParticipants: 1,
          createdBy: userId,
          source: 'test_consultation',
          hasTranscriptionData: false,
          summaryGeneratedAt: new Date()
        }
      };

      const summaryRef = db.collection('call-summaries').doc(roomName);
      await summaryRef.set(summaryData);
      console.log('✅ Test fallback summary stored successfully');
      
      return NextResponse.json({ 
        success: true, 
        message: 'Test consultation summary created successfully (fallback)',
        roomName,
        summaryData
      });
    }

    console.log('✅ OpenAI API key found, generating AI summary...');

    // Create a comprehensive prompt for medical consultation summarization
    const prompt = `You are a medical AI assistant specializing in summarizing telehealth consultations. 
    
    Generate a comprehensive, structured summary for a TEST medical consultation that took place in room: ${roomName}.
    
    Consultation details:
    - Duration: ${duration} minutes
    - Patient: ${patientName}
    - This is a TEST consultation (no actual conversation transcript available)
    
    Please provide the following structured response in JSON format:
    
    {
      "summary": "A concise 2-3 sentence overview of this test consultation. Mention it was a test consultation and the duration.",
      "keyPoints": ["Test consultation completed", "Duration: ${duration} minutes", "Patient: ${patientName}", "No transcript available"],
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
        duration: parseInt(duration),
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          totalParticipants: 1,
          createdBy: userId,
          source: 'test_consultation',
          hasTranscriptionData: false,
          summaryGeneratedAt: new Date()
        }
      };

      const summaryRef = db.collection('call-summaries').doc(roomName);
      await summaryRef.set(summaryData);
      console.log('✅ Test AI summary stored successfully in Firestore');
      
      return NextResponse.json({ 
        success: true, 
        message: 'Test consultation summary created successfully',
        roomName,
        summaryData
      });
      
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
        duration: parseInt(duration),
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          totalParticipants: 1,
          createdBy: userId,
          source: 'test_consultation',
          hasTranscriptionData: false,
          summaryGeneratedAt: new Date()
        }
      };

      const summaryRef = db.collection('call-summaries').doc(roomName);
      await summaryRef.set(summaryData);
      console.log('✅ Test fallback summary stored successfully');
      
      return NextResponse.json({ 
        success: true, 
        message: 'Test consultation summary created successfully (fallback)',
        roomName,
        summaryData
      });
    }
    
  } catch (error) {
    console.error('❌ Test consultation summary error:', error);
    return NextResponse.json({ 
      error: 'Failed to create test consultation summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

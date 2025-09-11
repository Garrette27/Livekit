import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { roomName } = await req.json();
    
    if (!roomName) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    // Get transcription data from Firestore
    const callRef = db.collection('calls').doc(roomName);
    const callDoc = await callRef.get();
    
    if (!callDoc.exists) {
      return NextResponse.json({ error: 'Call document not found' }, { status: 404 });
    }

    const callData = callDoc.data();
    const transcriptionData = callData?.transcription || [];
    
    console.log('Found transcription data:', transcriptionData.length, 'entries');
    console.log('Transcription content:', transcriptionData);

    // Generate summary with the transcription data
    const summary = await generateTestSummary(roomName, transcriptionData);
    
    // Store the summary
    const summaryRef = db.collection('call-summaries').doc(roomName);
    await summaryRef.set({
      roomName,
      summary: summary.summary,
      keyPoints: summary.keyPoints,
      recommendations: summary.recommendations,
      followUpActions: summary.followUpActions,
      riskLevel: summary.riskLevel,
      category: summary.category,
      participants: ['Test Patient'],
      duration: 3,
      createdAt: new Date(),
      createdBy: 'test-user',
      transcriptionData: transcriptionData,
      hasTranscriptionData: transcriptionData.length > 0,
      metadata: {
        totalParticipants: 1,
        createdBy: 'test-user',
        source: 'test_transcription_summary',
        hasTranscriptionData: transcriptionData.length > 0,
        transcriptionEntries: transcriptionData.length,
        summaryGeneratedAt: new Date()
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Test summary generated successfully',
      transcriptionEntries: transcriptionData.length,
      summary: summary
    });

  } catch (error) {
    console.error('❌ Test transcription summary error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate test summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function generateTestSummary(roomName: string, transcriptionData: any[]): Promise<any> {
  try {
    console.log('Generating test summary for room:', roomName);
    console.log('Transcription data length:', transcriptionData.length);
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ OpenAI API key not configured, using fallback summary');
      return {
        summary: 'Test summary - OpenAI not configured',
        keyPoints: ['Test summary generated'],
        recommendations: ['Configure OpenAI API for enhanced summaries'],
        followUpActions: ['Manual review required'],
        riskLevel: 'Unknown',
        category: 'Test Consultation'
      };
    }

    // Prepare conversation context
    let conversationContext = '';
    if (transcriptionData && transcriptionData.length > 0) {
      conversationContext = `\n\nActual conversation transcript:\n${transcriptionData.join('\n')}`;
    } else {
      conversationContext = '\n\nNo conversation transcript available.';
    }

    const prompt = `You are a medical AI assistant. Generate a summary for a consultation in room: ${roomName}.
    
    ${conversationContext}
    
    Please provide a structured response in JSON format:
    
    {
      "summary": "A concise overview of the consultation based on the transcript",
      "keyPoints": ["List of main topics discussed"],
      "recommendations": ["List of recommendations"],
      "followUpActions": ["List of follow-up actions"],
      "riskLevel": "Low/Medium/High",
      "category": "General Consultation"
    }`;

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
            content: 'You are a medical AI assistant. Always respond with valid JSON format.'
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
    
    // Clean and parse the JSON response
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const parsedSummary = JSON.parse(cleanContent);
    
    return {
      summary: parsedSummary.summary || 'Summary generation failed',
      keyPoints: parsedSummary.keyPoints || ['No key points available'],
      recommendations: parsedSummary.recommendations || ['No recommendations available'],
      followUpActions: parsedSummary.followUpActions || ['No follow-up actions specified'],
      riskLevel: parsedSummary.riskLevel || 'Unknown',
      category: parsedSummary.category || 'General Consultation'
    };
    
  } catch (error) {
    console.error('❌ Error generating test summary:', error);
    return {
      summary: 'Error generating test summary',
      keyPoints: ['Summary generation failed'],
      recommendations: ['Manual review required'],
      followUpActions: ['Contact technical support'],
      riskLevel: 'Unknown',
      category: 'General Consultation'
    };
  }
}

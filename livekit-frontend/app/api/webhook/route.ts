import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const event = await req.json();
    console.log('Webhook received:', event);

    if (event.event === 'room_finished') {
      const roomName = event.room?.name;
      console.log(`Room ${roomName} ended, processing...`);

      if (roomName) {
        // 1. Delete call record from Firestore immediately
        try {
          const callRef = db.collection('calls').doc(roomName);
          await callRef.delete();
          console.log(`Deleted call record for room: ${roomName}`);
        } catch (error) {
          console.error('Error deleting call record:', error);
        }

        // 2. Generate AI summary and store it
        try {
          const summary = await generateAISummary(roomName);
          
          // Store summary in a separate collection
          const summaryRef = db.collection('call-summaries').doc(roomName);
          await summaryRef.set({
            roomName,
            summary,
            createdAt: new Date(),
            participants: event.room?.participants || [],
            duration: event.room?.duration || 0,
          });
          
          console.log(`AI summary generated and stored for room: ${roomName}`);
        } catch (error) {
          console.error('Error generating AI summary:', error);
        }
      }
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

async function generateAISummary(roomName: string): Promise<string> {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key not configured, skipping AI summary');
      return 'AI summary not available - OpenAI not configured';
    }

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
            content: 'You are a helpful assistant that summarizes telehealth calls. Provide a concise, professional summary focusing on key points discussed, decisions made, and any follow-up actions needed.'
          },
          {
            role: 'user',
            content: `Generate a summary for the telehealth call in room: ${roomName}. Focus on the main topics discussed and any important outcomes.`
          }
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Summary generation failed';
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return 'Error generating AI summary';
  }
}

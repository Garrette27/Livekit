import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { roomName } = await req.json();
    
    if (!roomName) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
    }

    console.log(`🔄 Manually triggering webhook for room: ${roomName}`);

    // Simulate the webhook call to our own webhook endpoint
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/webhook`;
    
    const webhookPayload = {
      event: 'room_finished',
      room: {
        name: roomName,
        participants: ['doctor', 'patient'],
        duration: 10,
        recordingUrl: null,
        transcriptionUrl: null
      }
    };

    console.log('Calling webhook with payload:', JSON.stringify(webhookPayload, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Manual webhook triggered successfully:', result);
      return NextResponse.json({ 
        success: true, 
        message: 'Manual webhook triggered successfully',
        result 
      });
    } else {
      const errorText = await response.text();
      console.error('❌ Manual webhook failed:', response.status, errorText);
      return NextResponse.json({ 
        error: 'Manual webhook failed',
        status: response.status,
        details: errorText
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Manual webhook error:', error);
    return NextResponse.json({ 
      error: 'Manual webhook failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { roomName } = await req.json();
    
    if (!roomName) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
    }

    console.log(`🧪 Testing LiveKit webhook for room: ${roomName}`);

    // Simulate a LiveKit webhook event
    const webhookPayload = {
      event: 'room_finished',
      room: {
        name: roomName,
        participants: ['doctor', 'patient'],
        duration: 300, // 5 minutes
        recordingUrl: null,
        transcriptionUrl: null,
        metadata: {
          roomType: 'consultation',
          participants: 2
        }
      },
      timestamp: new Date().toISOString()
    };

    console.log('Webhook payload:', JSON.stringify(webhookPayload, null, 2));

    // Call our own webhook endpoint
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/webhook`;
    
    console.log('Calling webhook at:', webhookUrl);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Webhook test successful:', result);
      return NextResponse.json({ 
        success: true, 
        message: 'LiveKit webhook test successful',
        roomName,
        result 
      });
    } else {
      const errorText = await response.text();
      console.error('❌ Webhook test failed:', response.status, errorText);
      return NextResponse.json({ 
        error: 'Webhook test failed',
        status: response.status,
        details: errorText
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ LiveKit webhook test error:', error);
    return NextResponse.json({ 
      error: 'LiveKit webhook test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

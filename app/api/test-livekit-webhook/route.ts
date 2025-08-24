import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { roomName } = await req.json();
    console.log('Test LiveKit webhook for room:', roomName);

    if (!roomName) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
    }

    // Simulate the exact LiveKit webhook format
    const livekitWebhookPayload = {
      event: 'room_finished',
      room: {
        name: roomName,
        sid: `RM_${Date.now()}`,
        creation_time: new Date().toISOString(),
        metadata: 'test-consultation',
        participants: [
          {
            sid: 'PA_doctor',
            identity: 'doctor',
            name: 'Dr. Smith',
            metadata: 'role:doctor'
          },
          {
            sid: 'PA_patient',
            identity: 'patient',
            name: 'John Doe',
            metadata: 'role:patient'
          }
        ],
        duration: Math.floor(Math.random() * 30) + 5, // Random duration 5-35 minutes
        recording_url: null,
        transcription_url: null
      }
    };

    console.log('Simulating LiveKit webhook payload:', livekitWebhookPayload);

    // Call our actual webhook endpoint with the LiveKit format
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/webhook`;
    
    console.log('Calling webhook endpoint:', webhookUrl);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LiveKit-Webhook/1.0'
      },
      body: JSON.stringify(livekitWebhookPayload),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ LiveKit webhook test successful:', result);
      return NextResponse.json({ 
        success: true, 
        message: 'LiveKit webhook test completed successfully',
        roomName,
        webhookResponse: result
      });
    } else {
      const errorText = await response.text();
      console.error('❌ LiveKit webhook test failed:', response.status, errorText);
      return NextResponse.json({ 
        error: 'LiveKit webhook test failed',
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

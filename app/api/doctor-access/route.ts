import { NextResponse, NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomName, doctorName, doctorEmail } = body;

    if (!roomName || !doctorName) {
      return NextResponse.json(
        { success: false, error: 'Room name and doctor name are required' },
        { status: 400 }
      );
    }

    // Generate LiveKit token for doctor access (bypasses invitation restrictions)
    const liveKitToken = jwt.sign(
      {
        sub: `doctor_${Date.now()}`,
        video: {
          roomJoin: true,
          room: roomName,
          canPublish: true,
          canSubscribe: true,
        },
        metadata: JSON.stringify({
          doctorName,
          doctorEmail: doctorEmail || 'anonymous@example.com',
          roomName,
          participantType: 'doctor',
          joinedVia: 'doctor-direct-access',
          timestamp: new Date().toISOString(),
        }),
      },
      process.env.LIVEKIT_API_SECRET || 'fallback-secret',
      {
        issuer: process.env.LIVEKIT_API_KEY,
        expiresIn: '4h', // Longer duration for doctors
        algorithm: 'HS256',
      }
    );

    const response = {
      success: true,
      token: liveKitToken,
      roomName,
      participantType: 'doctor',
      message: 'Doctor access granted',
    };

    console.log('Doctor access granted:', {
      roomName,
      doctorName,
      doctorEmail,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error generating doctor access token:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    const { roomName, participantName } = await req.json();

    // Log all environment variables for debugging
    console.log('Environment variables check:');
    console.log('LIVEKIT_API_KEY exists:', !!process.env.LIVEKIT_API_KEY);
    console.log('LIVEKIT_API_SECRET exists:', !!process.env.LIVEKIT_API_SECRET);
    console.log('NEXT_PUBLIC_LIVEKIT_URL exists:', !!process.env.NEXT_PUBLIC_LIVEKIT_URL);
    console.log('LIVEKIT_URL exists:', !!process.env.LIVEKIT_URL);
    
    // Log partial values for debugging (first 4 and last 4 characters)
    if (process.env.LIVEKIT_API_KEY) {
      const key = process.env.LIVEKIT_API_KEY;
      console.log('API Key preview:', key.substring(0, 4) + '...' + key.substring(key.length - 4));
    }
    if (process.env.LIVEKIT_API_SECRET) {
      const secret = process.env.LIVEKIT_API_SECRET;
      console.log('API Secret preview:', secret.substring(0, 4) + '...' + secret.substring(secret.length - 4));
    }

    // Validate required environment variables
    if (!process.env.LIVEKIT_API_KEY) {
      console.error('LIVEKIT_API_KEY is not set');
      return NextResponse.json(
        { error: 'LiveKit API key not configured' },
        { status: 500 }
      );
    }

    if (!process.env.LIVEKIT_API_SECRET) {
      console.error('LIVEKIT_API_SECRET is not set');
      return NextResponse.json(
        { error: 'LiveKit API secret not configured' },
        { status: 500 }
      );
    }

    if (!process.env.NEXT_PUBLIC_LIVEKIT_URL) {
      console.error('NEXT_PUBLIC_LIVEKIT_URL is not set');
      return NextResponse.json(
        { error: 'LiveKit URL not configured' },
        { status: 500 }
      );
    }

    // Validate input parameters
    if (!roomName || !participantName) {
      return NextResponse.json(
        { error: 'Room name and participant name are required' },
        { status: 400 }
      );
    }

    console.log('Generating token for:', { roomName, participantName });

    // Create JWT token manually with explicit HS256 algorithm
    const token = jwt.sign(
      {
        sub: participantName,
        video: {
          roomJoin: true,
          room: roomName,
        },
      },
      process.env.LIVEKIT_API_SECRET,
      {
        issuer: process.env.LIVEKIT_API_KEY,
        expiresIn: "1h",
        algorithm: "HS256", // Explicitly set HS256 algorithm
      }
    );

    console.log('Token generated successfully');
    console.log('Token type:', typeof token);
    console.log('Token length:', token.length);
    console.log('Token preview:', token.substring(0, 50) + '...');
    
    // Decode and log token payload for debugging
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      console.log('Token payload:', {
        iss: payload.iss,
        sub: payload.sub,
        exp: payload.exp,
        video: payload.video
      });
    } catch (e) {
      console.log('Could not decode token payload');
    }

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}

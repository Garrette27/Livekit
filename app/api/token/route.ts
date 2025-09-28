import { NextResponse, NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { withRateLimit, RateLimitConfigs } from "../../../lib/rate-limit";
import { validateRoomName, validateParticipantName, sanitizeInput } from "../../../lib/validation";

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = withRateLimit(RateLimitConfigs.TOKEN_GENERATION)(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { roomName, participantName } = await req.json();

    // Input validation and sanitization
    if (!roomName || !participantName) {
      return NextResponse.json(
        { error: 'Room name and participant name are required' },
        { status: 400 }
      );
    }

    const sanitizedRoomName = sanitizeInput(roomName);
    const sanitizedParticipantName = sanitizeInput(participantName);

    if (!validateRoomName(sanitizedRoomName)) {
      return NextResponse.json(
        { error: 'Invalid room name. Must be 3-50 characters, alphanumeric with hyphens/underscores only' },
        { status: 400 }
      );
    }

    if (!validateParticipantName(sanitizedParticipantName)) {
      return NextResponse.json(
        { error: 'Invalid participant name. Must be 2-100 characters, letters, numbers, spaces, and basic punctuation only' },
        { status: 400 }
      );
    }

    // Log environment variables (without exposing sensitive data)
    console.log('Environment variables check:');
    console.log('LIVEKIT_API_KEY exists:', !!process.env.LIVEKIT_API_KEY);
    console.log('LIVEKIT_API_SECRET exists:', !!process.env.LIVEKIT_API_SECRET);
    console.log('NEXT_PUBLIC_LIVEKIT_URL exists:', !!process.env.NEXT_PUBLIC_LIVEKIT_URL);

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

    console.log('Generating token for:', { roomName: sanitizedRoomName, participantName: sanitizedParticipantName });

    // Create JWT token manually with explicit HS256 algorithm
    const token = jwt.sign(
      {
        sub: sanitizedParticipantName,
        video: {
          roomJoin: true,
          room: sanitizedRoomName,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        },
        audio: {
          roomJoin: true,
          room: sanitizedRoomName,
          canPublish: true,
          canSubscribe: true,
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

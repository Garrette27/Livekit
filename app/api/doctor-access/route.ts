import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextResponse, NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { authenticateBearerToken } from '@/lib/services/shared/request-auth';
import { serviceResultToResponse } from '@/lib/services/shared/http';
import { getJwtSecret } from '@/lib/invitations/token-utils';

/**
 * Issues a LiveKit room token for a doctor joining their own room. Doctor
 * tokens bypass invitation restrictions, so the caller must prove they are a
 * signed-in user with the doctor role — an unauthenticated caller must never
 * be able to mint one.
 */
async function handlePOST(req: NextRequest) {
  try {
    const auth = await authenticateBearerToken(req);
    if (!auth.ok) {
      return serviceResultToResponse(auth);
    }

    const body = await req.json();
    const { roomName, doctorName } = body;

    if (!roomName || !doctorName) {
      return NextResponse.json(
        { success: false, error: 'Room name and doctor name are required' },
        { status: 400 }
      );
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    const userDoc = await db.collection('users').doc(auth.data.userId).get();
    const role = userDoc.exists ? userDoc.data()?.role : null;
    if (role !== 'doctor') {
      return NextResponse.json(
        { success: false, error: 'Doctor role required' },
        { status: 403 }
      );
    }

    const doctorEmail = auth.data.email || userDoc.data()?.email || null;
    const liveKitToken = jwt.sign(
      {
        sub: `doctor_${auth.data.userId}`,
        name: doctorName,
        video: {
          roomJoin: true,
          room: roomName,
          canPublish: true,
          canSubscribe: true,
        },
        metadata: JSON.stringify({
          doctorName,
          doctorEmail,
          doctorUserId: auth.data.userId,
          roomName,
          participantType: 'doctor',
          joinedVia: 'doctor-direct-access',
          timestamp: new Date().toISOString(),
        }),
      },
      getJwtSecret(),
      {
        issuer: process.env.LIVEKIT_API_KEY,
        expiresIn: '4h', // Longer duration for doctors
        algorithm: 'HS256',
      }
    );

    console.log('Doctor access granted:', {
      roomName,
      doctorUserId: auth.data.userId,
      doctorEmail,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      token: liveKitToken,
      roomName,
      participantType: 'doctor',
      message: 'Doctor access granted',
    });
  } catch (error) {
    console.error('Error generating doctor access token:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);

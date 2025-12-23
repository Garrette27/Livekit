import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import jwt from 'jsonwebtoken';
import { AdmitPatientRequest, AdmitPatientResponse, WaitingPatient } from '../../../../lib/types';

export async function POST(req: NextRequest) {
  try {
    const body: AdmitPatientRequest = await req.json();
    const { waitingPatientId, roomName } = body;

    if (!waitingPatientId || !roomName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: waitingPatientId and roomName are required' },
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

    // Get waiting patient
    const waitingPatientDoc = await db.collection('waitingPatients').doc(waitingPatientId).get();
    if (!waitingPatientDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Waiting patient not found' },
        { status: 404 }
      );
    }

    const waitingPatient = { id: waitingPatientDoc.id, ...waitingPatientDoc.data() } as WaitingPatient;

    // Verify patient is still waiting
    if (waitingPatient.status !== 'waiting') {
      return NextResponse.json(
        { success: false, error: `Patient is no longer waiting. Current status: ${waitingPatient.status}` },
        { status: 400 }
      );
    }

    // Verify room name matches
    if (waitingPatient.roomName !== roomName) {
      return NextResponse.json(
        { success: false, error: 'Room name mismatch' },
        { status: 400 }
      );
    }

    // Generate LiveKit token for main consultation room
    const liveKitToken = jwt.sign(
      {
        sub: `patient_${waitingPatient.invitationId}_${waitingPatient.id}`,
        video: {
          roomJoin: true,
          room: roomName,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        },
        audio: {
          roomJoin: true,
          room: roomName,
          canPublish: true,
          canSubscribe: true,
        },
      },
      process.env.LIVEKIT_API_SECRET || 'fallback-secret',
      {
        issuer: process.env.LIVEKIT_API_KEY,
        expiresIn: '2h', // Longer duration for consultation
        algorithm: 'HS256',
      }
    );

    // Update waiting patient status to admitted
    await db.collection('waitingPatients').doc(waitingPatientId).update({
      status: 'admitted',
      admittedAt: new Date(),
    });

    const response: AdmitPatientResponse = {
      success: true,
      liveKitToken,
      roomName,
    };

    console.log('Patient admitted to consultation room:', {
      waitingPatientId,
      patientId: waitingPatient.patientId,
      patientName: waitingPatient.patientName,
      roomName,
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error admitting patient:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}


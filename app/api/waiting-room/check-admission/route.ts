import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invitationId, patientEmail } = body;

    if (!invitationId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: invitationId' },
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

    // Find patient by invitation ID - check both waiting and admitted statuses
    let allPatientsQuery = db.collection('waitingPatients')
      .where('invitationId', '==', invitationId);

    const querySnapshot = await allPatientsQuery.get();

    // Find the most recent patient for this invitation
    let waitingPatient = null;
    if (!querySnapshot.empty) {
      // Filter and sort patients
      const patients = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // If email provided, try to match by email first
      if (patientEmail) {
        const patientByEmail = patients.find(p => 
          p.patientEmail?.toLowerCase() === patientEmail.toLowerCase()
        );
        if (patientByEmail) {
          waitingPatient = patientByEmail;
        }
      }
      
      // If not found by email, use the most recent one
      if (!waitingPatient && patients.length > 0) {
        const mostRecent = patients.sort((a, b) => {
          const aTime = a.joinedAt?.toMillis?.() || a.joinedAt?.getTime?.() || new Date(a.joinedAt).getTime();
          const bTime = b.joinedAt?.toMillis?.() || b.joinedAt?.getTime?.() || new Date(b.joinedAt).getTime();
          return bTime - aTime;
        })[0];
        waitingPatient = mostRecent;
      }
    }

    if (!waitingPatient) {
      return NextResponse.json({
        success: false,
        admitted: false,
        error: 'Waiting patient not found',
      });
    }

    // Check if patient has been admitted
    if (waitingPatient.status === 'admitted') {
      // Generate token for main consultation room
      const liveKitToken = jwt.sign(
        {
          sub: `patient_${waitingPatient.invitationId}_${waitingPatient.id}`,
          video: {
            roomJoin: true,
            room: waitingPatient.roomName,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
          },
          audio: {
            roomJoin: true,
            room: waitingPatient.roomName,
            canPublish: true,
            canSubscribe: true,
          },
        },
        process.env.LIVEKIT_API_SECRET || 'fallback-secret',
        {
          issuer: process.env.LIVEKIT_API_KEY,
          expiresIn: '2h',
          algorithm: 'HS256',
        }
      );

      return NextResponse.json({
        success: true,
        admitted: true,
        liveKitToken,
        roomName: waitingPatient.roomName,
      });
    }

    // Patient is still waiting
    return NextResponse.json({
      success: true,
      admitted: false,
      waitingPatientId: waitingPatient.id,
    });

  } catch (error) {
    console.error('Error checking admission status:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}


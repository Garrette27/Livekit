import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { signLiveKitRoomToken } from '../../../../lib/invitations/token-utils';
import { WaitingPatient } from '../../../../lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invitationId, patientEmail, waitingPatientId } = body as {
      invitationId?: string;
      patientEmail?: string;
      waitingPatientId?: string;
    };

    if (!invitationId && !waitingPatientId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: invitationId or waitingPatientId' },
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

    const buildAdmissionResponse = (waitingPatient: WaitingPatient) => {
      const liveKitToken = signLiveKitRoomToken({
        subject: `patient_${waitingPatient.invitationId}_${waitingPatient.id}`,
        roomName: waitingPatient.roomName,
        participantName: waitingPatient.patientName || waitingPatient.patientEmail || 'Anonymous Patient',
        expiresIn: '2h',
      });

      return NextResponse.json({
        success: true,
        admitted: true,
        waitingPatientId: waitingPatient.id,
        liveKitToken,
        roomName: waitingPatient.roomName,
      });
    };

    if (waitingPatientId) {
      const waitingPatientDoc = await db.collection('waitingPatients').doc(waitingPatientId).get();
      if (!waitingPatientDoc.exists) {
        return NextResponse.json({
          success: false,
          admitted: false,
          error: 'Waiting patient not found',
        });
      }

      const waitingPatient = {
        id: waitingPatientDoc.id,
        ...waitingPatientDoc.data(),
      } as WaitingPatient;

      if (invitationId && waitingPatient.invitationId !== invitationId) {
        return NextResponse.json({
          success: false,
          admitted: false,
          error: 'Waiting patient invitation mismatch',
        });
      }

      if (waitingPatient.status === 'admitted') {
        return buildAdmissionResponse(waitingPatient);
      }

      return NextResponse.json({
        success: true,
        admitted: false,
        waitingPatientId: waitingPatient.id,
      });
    }

    // Find patient by invitation ID across both waiting and admitted statuses.
    const allPatientsQuery = db.collection('waitingPatients')
      .where('invitationId', '==', invitationId);

    const querySnapshot = await allPatientsQuery.get();

    // Resolve the most relevant record for this visit.
    // Priority: newest waiting -> newest admitted -> newest any.
    let waitingPatient: WaitingPatient | null = null;
    if (!querySnapshot.empty) {
      const allPatients = querySnapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      })) as WaitingPatient[];

      const normalizedEmail = typeof patientEmail === 'string' ? patientEmail.toLowerCase() : '';
      const scopedPatients = normalizedEmail
        ? allPatients.filter((patient) => patient.patientEmail?.toLowerCase() === normalizedEmail)
        : allPatients;

      const sortedPatients = [...scopedPatients].sort((a, b) => {
        const aTime =
          a.joinedAt?.toMillis?.()
          || a.joinedAt?.getTime?.()
          || new Date(a.joinedAt as unknown as string).getTime()
          || 0;
        const bTime =
          b.joinedAt?.toMillis?.()
          || b.joinedAt?.getTime?.()
          || new Date(b.joinedAt as unknown as string).getTime()
          || 0;
        return bTime - aTime;
      });

      if (sortedPatients.length > 0) {
        waitingPatient =
          sortedPatients.find((patient) => patient.status === 'waiting')
          || sortedPatients.find((patient) => patient.status === 'admitted')
          || sortedPatients[0];
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
      return buildAdmissionResponse(waitingPatient);
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


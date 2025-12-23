import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { waitingPatientId } = body;

    if (!waitingPatientId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: waitingPatientId' },
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

    // Update waiting patient status to rejected/left
    await db.collection('waitingPatients').doc(waitingPatientId).update({
      status: 'left',
      leftAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Patient removed from waiting room',
    });

  } catch (error) {
    console.error('Error rejecting patient:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}


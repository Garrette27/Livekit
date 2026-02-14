import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const waitingPatientId = typeof body.waitingPatientId === 'string' ? body.waitingPatientId.trim() : '';

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

    const waitingRef = db.collection('waitingPatients').doc(waitingPatientId);
    const waitingDoc = await waitingRef.get();
    if (!waitingDoc.exists) {
      return NextResponse.json({
        success: true,
        message: 'Waiting entry already removed',
      });
    }

    await waitingRef.update({
      status: 'left',
      leftAt: new Date(),
      'metadata.lastAccessed': new Date(),
    });

    return NextResponse.json({
      success: true,
      waitingPatientId,
    });
  } catch (error) {
    console.error('Error marking waiting patient left:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

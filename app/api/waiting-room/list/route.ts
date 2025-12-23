import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { WaitingPatient } from '../../../../lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomName = searchParams.get('roomName');

    if (!roomName) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: roomName' },
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

    // Get all waiting patients for this room
    const waitingPatientsQuery = await db.collection('waitingPatients')
      .where('roomName', '==', roomName)
      .where('status', '==', 'waiting')
      .orderBy('joinedAt', 'asc')
      .get();

    const waitingPatients = waitingPatientsQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as WaitingPatient));

    return NextResponse.json({
      success: true,
      waitingPatients,
      count: waitingPatients.length,
    });

  } catch (error) {
    console.error('Error fetching waiting patients:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}


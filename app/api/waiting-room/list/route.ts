import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebase-admin';
import { WaitingPatient } from '../../../../lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomName = searchParams.get('roomName');
    const invitationId = searchParams.get('invitationId');
    const doctorUserId = searchParams.get('doctorUserId'); // Add doctorUserId parameter

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    let waitingPatientsQuery;
    
    // If doctorUserId is provided, use it (most efficient for security)
    if (doctorUserId) {
      waitingPatientsQuery = await db.collection('waitingPatients')
        .where('doctorUserId', '==', doctorUserId)
        .where('status', '==', 'waiting')
        .get();
    } else if (invitationId) {
      // If invitationId is provided, use it (more efficient, no index needed)
      waitingPatientsQuery = await db.collection('waitingPatients')
        .where('invitationId', '==', invitationId)
        .where('status', '==', 'waiting')
        .get();
    } else if (roomName) {
      // Fallback to roomName query (requires index)
      // Get all invitations for this room first, then query waiting patients
      const invitationsQuery = await db.collection('invitations')
        .where('roomName', '==', roomName)
        .where('status', '==', 'active')
        .where('waitingRoomEnabled', '==', true)
        .get();
      
      const invitationIds = invitationsQuery.docs.map(doc => doc.id);
      
      if (invitationIds.length === 0) {
        return NextResponse.json({
          success: true,
          waitingPatients: [],
          count: 0,
        });
      }

      // Query waiting patients for all invitations (no orderBy to avoid index requirement)
      const queries = invitationIds.map(id => 
        db.collection('waitingPatients')
          .where('invitationId', '==', id)
          .where('status', '==', 'waiting')
          .get()
      );
      
      const results = await Promise.all(queries);
      const allPatients: any[] = [];
      results.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          allPatients.push({ id: doc.id, ...doc.data() });
        });
      });
      
      // Sort in memory by joinedAt
      allPatients.sort((a, b) => {
        const aTime = a.joinedAt?.toMillis?.() || (a.joinedAt instanceof Date ? a.joinedAt.getTime() : 0);
        const bTime = b.joinedAt?.toMillis?.() || (b.joinedAt instanceof Date ? b.joinedAt.getTime() : 0);
        return aTime - bTime;
      });

      return NextResponse.json({
        success: true,
        waitingPatients: allPatients,
        count: allPatients.length,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: roomName, invitationId, or doctorUserId' },
        { status: 400 }
      );
    }

    // Process query results for doctorUserId or invitationId paths
    if (waitingPatientsQuery) {
      const waitingPatients = waitingPatientsQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as WaitingPatient));

      return NextResponse.json({
        success: true,
        waitingPatients,
        count: waitingPatients.length,
      });
    }

    // This should never be reached, but TypeScript needs it
    return NextResponse.json(
      { success: false, error: 'Unexpected error: no query executed' },
      { status: 500 }
    );

  } catch (error) {
    console.error('Error fetching waiting patients:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

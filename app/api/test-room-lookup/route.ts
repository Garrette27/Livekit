import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { roomName } = await req.json();
    console.log(`Testing room lookup for: ${roomName}`);

    if (!roomName) {
      return NextResponse.json({ 
        error: 'Room name is required' 
      }, { status: 400 });
    }

    const db = getFirebaseAdmin();
    if (!db) {
      console.error('❌ Firebase Admin not initialized');
      return NextResponse.json({ 
        error: 'Firebase Admin not initialized',
        message: 'Please check your Firebase environment variables'
      }, { status: 500 });
    }

    // Look up the room creator (doctor)
    try {
      const roomRef = db.collection('rooms').doc(roomName);
      const roomDoc = await roomRef.get();
      
      if (roomDoc.exists) {
        const roomData = roomDoc.data();
        const doctorUserId = roomData?.createdBy || roomData?.metadata?.createdBy || 'unknown';
        
        console.log(`Found room creator: ${doctorUserId} for room: ${roomName}`);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Room lookup successful',
          roomName,
          doctorUserId,
          roomData: {
            createdBy: roomData?.createdBy,
            metadata: roomData?.metadata,
            createdAt: roomData?.createdAt,
            status: roomData?.status
          }
        });
      } else {
        console.log(`Room ${roomName} not found in rooms collection`);
        return NextResponse.json({ 
          success: false, 
          message: 'Room not found',
          roomName
        });
      }
    } catch (error) {
      console.error('Error looking up room:', error);
      return NextResponse.json({ 
        error: 'Failed to lookup room',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Test room lookup error:', error);
    return NextResponse.json({ 
      error: 'Failed to test room lookup',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

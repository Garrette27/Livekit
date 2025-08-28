import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { roomName, action, participantName, userId } = await req.json();
    console.log('Consultation tracking:', { roomName, action, participantName, userId });

    if (!roomName || !action) {
      return NextResponse.json({ error: 'Room name and action are required' }, { status: 400 });
    }

    const db = getFirebaseAdmin();
    if (!db) {
      console.error('❌ Firebase Admin not initialized');
      return NextResponse.json({ 
        error: 'Firebase Admin not initialized',
        message: 'Please check your Firebase environment variables'
      }, { status: 500 });
    }

    const consultationRef = db.collection('consultations').doc(roomName);
    
    if (action === 'join') {
      // Track when patient joins
      await consultationRef.set({
        roomName,
        patientJoined: new Date(),
        participantName,
        createdBy: userId || 'unknown',
        status: 'active',
        metadata: {
          createdBy: userId || 'unknown',
          userId: userId || 'unknown',
          patientName: participantName
        }
      }, { merge: true });
      
      console.log(`✅ Patient joined consultation: ${roomName}`);
      
    } else if (action === 'leave') {
      // Track when patient leaves and calculate duration
      const consultationDoc = await consultationRef.get();
      if (consultationDoc.exists) {
        const data = consultationDoc.data();
        const joinTime = data?.patientJoined?.toDate() || new Date();
        const leaveTime = new Date();
        const durationMinutes = Math.round((leaveTime.getTime() - joinTime.getTime()) / 1000 / 60);
        
        await consultationRef.update({
          patientLeft: leaveTime,
          durationMinutes,
          status: 'completed',
          metadata: {
            ...data?.metadata,
            durationMinutes,
            completedAt: leaveTime
          }
        });
        
        console.log(`✅ Patient left consultation: ${roomName}, duration: ${durationMinutes} minutes`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Consultation ${action} tracked successfully`,
      roomName,
      action
    });

  } catch (error) {
    console.error('❌ Consultation tracking error:', error);
    return NextResponse.json({ 
      error: 'Consultation tracking failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

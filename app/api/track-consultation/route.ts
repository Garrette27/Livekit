import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { roomName, action, patientName, duration } = await req.json();
    console.log(`Track consultation: ${action} for room: ${roomName}`);

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
        patientName: patientName || 'Unknown Patient',
        joinedAt: new Date(),
        status: 'active',
        isRealConsultation: true, // Mark as real consultation, not test
        metadata: {
          source: 'patient_join',
          trackedAt: new Date()
        }
      }, { merge: true });
      
      console.log(`✅ Patient joined consultation: ${roomName}`);
      
    } else if (action === 'leave') {
      // Track when patient leaves and calculate duration
      const consultationDoc = await consultationRef.get();
      if (consultationDoc.exists) {
        const data = consultationDoc.data();
        const joinedAt = data?.joinedAt?.toDate() || new Date();
        const leftAt = new Date();
        const durationMinutes = Math.round((leftAt.getTime() - joinedAt.getTime()) / (1000 * 60));
        
        await consultationRef.update({
          leftAt,
          duration: durationMinutes,
          status: 'completed',
          isRealConsultation: true,
          metadata: {
            ...data?.metadata,
            source: 'patient_leave',
            durationMinutes,
            trackedAt: new Date()
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
    console.error('❌ Track consultation error:', error);
    return NextResponse.json({ 
      error: 'Failed to track consultation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function GET() {
  try {
    console.log('🧪 Test webhook endpoint called');
    
    // First, check environment variables
    const envCheck = {
      FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY
    };
    
    console.log('Environment variables check:', envCheck);
    
    // Test Firebase Admin connection
    console.log('Attempting to initialize Firebase Admin...');
    const db = getFirebaseAdmin();
    
    if (!db) {
      console.error('❌ Firebase Admin not initialized');
      return NextResponse.json({ 
        error: 'Firebase Admin not initialized',
        envCheck,
        message: 'Please check your Firebase environment variables'
      }, { status: 500 });
    }

    console.log('✅ Firebase Admin initialized successfully');

    // Test basic Firestore operations
    try {
      console.log('Testing Firestore write operation...');
      const testRoomName = `test-room-${Date.now()}`;
      const testSummary = {
        roomName: testRoomName,
        summary: 'This is a test consultation summary generated for testing purposes.',
        keyPoints: ['Test consultation', 'Sample data', 'Verification purposes'],
        recommendations: ['This is a test recommendation'],
        followUpActions: ['No actual follow-up needed - this is a test'],
        riskLevel: 'Low',
        category: 'Test Consultation',
        createdAt: new Date(),
        participants: ['test-doctor', 'test-patient'],
        duration: 5,
        metadata: {
          totalParticipants: 2,
          recordingUrl: null,
          transcriptionUrl: null,
        }
      };

      const summaryRef = db.collection('call-summaries').doc(testRoomName);
      await summaryRef.set(testSummary);
      console.log('✅ Test summary stored successfully');

      // Verify it was stored
      const storedSummary = await summaryRef.get();
      if (storedSummary.exists) {
        console.log('✅ Test summary verified in database');
        
        // Clean up test data
        await summaryRef.delete();
        console.log('✅ Test data cleaned up');
        
        return NextResponse.json({ 
          success: true, 
          message: 'Firebase connection and storage test successful',
          roomName: testRoomName,
          envCheck,
          summary: storedSummary.data()
        });
      } else {
        console.error('❌ Test summary not found after storage');
        return NextResponse.json({ 
          error: 'Test summary not found after storage',
          envCheck
        }, { status: 500 });
      }
    } catch (firestoreError) {
      console.error('❌ Error with Firestore operations:', firestoreError);
      return NextResponse.json({ 
        error: 'Firestore operation failed',
        details: firestoreError instanceof Error ? firestoreError.message : 'Unknown error',
        envCheck
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Test webhook error:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

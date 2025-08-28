import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { roomName, testData, userId, isTest } = await req.json();
    console.log('Test transcription triggered for room:', roomName);

    if (!roomName) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
    }

    // Create test transcription data
    const testTranscription = testData || [
      `[Doctor] (${new Date().toISOString()}): Hello, how are you feeling today?`,
      `[Patient] (${new Date().toISOString()}): I've been experiencing some issues with binary search trees and data structures.`,
      `[Doctor] (${new Date().toISOString()}): I understand. Let's discuss your symptoms and see how we can help with your algorithm problems.`,
      `[Patient] (${new Date().toISOString()}): Yes, I've been having trouble with time complexity and space complexity analysis.`,
      `[Doctor] (${new Date().toISOString()}): That's a common issue. Let me explain how we can optimize your approach.`,
      `[Manual Note] (${new Date().toISOString()}): Patient discussed binary search trees, time complexity, and algorithm optimization. Recommended further study of data structures.`
    ];

    // Store test transcription in Firestore
    const db = getFirebaseAdmin();
    if (db) {
      console.log('Storing test transcription data...');
      const callRef = db.collection('calls').doc(roomName);
      await callRef.set({
        roomName,
        transcription: testTranscription,
        lastTranscriptionUpdate: new Date(),
        testData: isTest || true,
        createdBy: userId || 'unknown', // Store user ID
        metadata: {
          createdBy: userId || 'unknown',
          userId: userId || 'unknown',
          testData: isTest || true,
          isTestData: isTest || true
        }
      });
      
      console.log(`✅ Test transcription stored for room: ${roomName}`);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Test transcription data stored successfully',
        roomName,
        transcriptionEntries: testTranscription.length,
        transcription: testTranscription
      });
    } else {
      console.error('❌ Firebase Admin not initialized');
      return NextResponse.json({ 
        error: 'Firebase Admin not initialized',
        message: 'Please check your Firebase environment variables'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Test transcription error:', error);
    return NextResponse.json({ 
      error: 'Test transcription failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

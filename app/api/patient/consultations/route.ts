import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin, getFirebaseAdminAuth } from '@/lib/firebase-admin';
import { FirestoreSummaryProjectionService } from '@/lib/services/history-summary';

async function handleGET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Authorization token required' }, { status: 401 });
    }

    const idToken = authHeader.slice(7);
    const adminAuth = getFirebaseAdminAuth();
    if (!adminAuth) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin auth not initialized' },
        { status: 500 }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const patientUserId = decodedToken.uid;
    const patientEmail = (decodedToken.email || '').trim().toLowerCase();

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 });
    }

    const historyProjection = new FirestoreSummaryProjectionService(db);
    const summaries = await historyProjection.buildPatientHistory({
      patientUserId,
      patientEmail: patientEmail || null,
    });

    return NextResponse.json({
      success: true,
      summaries,
      count: summaries.length,
    });
  } catch (error) {
    console.error('Error fetching patient consultations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch patient consultations',
      },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);

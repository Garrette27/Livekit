import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { FirestoreSummaryProjectionService } from '@/lib/services/history-summary';
import { authorizeBearerRequest } from '@/lib/services/shared/request-auth';
import { serviceResultToResponse } from '@/lib/services/shared/http';

async function handleGET(req: NextRequest) {
  try {
    const auth = await authorizeBearerRequest(req, 'consultation:read-own');
    if (!auth.ok) {
      return serviceResultToResponse(auth);
    }
    if (auth.data.role !== 'patient' && auth.data.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Patient role required' },
        { status: 403 }
      );
    }
    const patientUserId = auth.data.userId;
    const patientEmail = (auth.data.email || '').trim().toLowerCase();

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

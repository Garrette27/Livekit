import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

interface LinkConsultationsRequest {
  userId?: string;
  userEmail?: string;
  pendingSessionIds?: string[];
}

const PLACEHOLDER_PATIENT_IDS = new Set(['anonymous', 'unknown', '']);

function normalizeEmail(email: string | undefined): string {
  return (email || '').trim().toLowerCase();
}

function normalizeSessionIds(sessionIds: string[] | undefined): string[] {
  if (!Array.isArray(sessionIds)) {
    return [];
  }

  return Array.from(
    new Set(sessionIds.map((sessionId) => sessionId.trim()).filter((sessionId) => sessionId.length > 0))
  ).slice(0, 100);
}

function canRelinkPatient(currentPatientUserId: unknown, nextPatientUserId: string): boolean {
  if (typeof currentPatientUserId !== 'string') {
    return true;
  }

  if (currentPatientUserId === nextPatientUserId) {
    return false;
  }

  return PLACEHOLDER_PATIENT_IDS.has(currentPatientUserId);
}

function mergeVisibleUsers(existingVisibleToUsers: unknown, doctorUserId: unknown, patientUserId: string) {
  const candidates = Array.isArray(existingVisibleToUsers) ? existingVisibleToUsers : [];
  return Array.from(
    new Set(
      [...candidates, doctorUserId, patientUserId].filter(
        (value) => typeof value === 'string' && !PLACEHOLDER_PATIENT_IDS.has(value)
      )
    )
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LinkConsultationsRequest;
    const userId = (body.userId || '').trim();
    const userEmail = normalizeEmail(body.userEmail);
    const pendingSessionIds = normalizeSessionIds(body.pendingSessionIds);

    if (!userId || !userEmail) {
      return NextResponse.json(
        { success: false, error: 'userId and userEmail are required' },
        { status: 400 }
      );
    }

    const db = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    let linkedCount = 0;
    const linkedSessionIds = new Set<string>();

    const linkSessionById = async (
      consultationSessionId: string,
      options?: { forceRelink?: boolean }
    ) => {
      const forceRelink = Boolean(options?.forceRelink);
      const sessionRef = db.collection('consultationSessions').doc(consultationSessionId);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        return;
      }

      const sessionData = sessionDoc.data() || {};
      const doctorUserId = sessionData.doctorUserId;
      if (typeof doctorUserId === 'string' && doctorUserId === userId) {
        return;
      }

      const currentPatientUserId = sessionData.patientUserId;
      if (!forceRelink && !canRelinkPatient(currentPatientUserId, userId)) {
        linkedSessionIds.add(consultationSessionId);
        return;
      }

      await sessionRef.set(
        {
          patientUserId: userId,
          metadata: {
            ...(sessionData.metadata || {}),
            patientUserId: userId,
            patientEmail: userEmail,
          },
          updatedAt: new Date(),
        },
        { merge: true }
      );

      linkedSessionIds.add(consultationSessionId);
      linkedCount += 1;

      const roomName = sessionData.roomName;
      if (typeof roomName === 'string' && roomName.trim()) {
        const consultationRef = db.collection('consultations').doc(roomName);
        const consultationDoc = await consultationRef.get();
        if (consultationDoc.exists) {
          const consultationData = consultationDoc.data() || {};
          const consultationDoctorUserId =
            consultationData.createdBy ||
            consultationData.metadata?.createdBy ||
            consultationData.metadata?.doctorUserId;

          if (consultationDoctorUserId !== userId) {
            const visibleToUsers = mergeVisibleUsers(
              consultationData.metadata?.visibleToUsers,
              consultationDoctorUserId,
              userId
            );

            await consultationRef.set(
              {
                patientUserId: userId,
                patientEmail: userEmail,
                metadata: {
                  ...(consultationData.metadata || {}),
                  patientUserId: userId,
                  patientEmail: userEmail,
                  visibleToUsers,
                },
              },
              { merge: true }
            );
          }
        }
      }

      const summaryRef = db.collection('call-summaries').doc(consultationSessionId);
      const summaryDoc = await summaryRef.get();
      if (summaryDoc.exists) {
        const summaryData = summaryDoc.data() || {};
        const summaryDoctorUserId = summaryData.createdBy || summaryData.metadata?.createdBy;
        if (summaryDoctorUserId !== userId) {
          await summaryRef.set(
            {
              patientUserId: userId,
              patientEmail: userEmail,
              metadata: {
                ...(summaryData.metadata || {}),
                patientUserId: userId,
                patientEmail: userEmail,
              },
            },
            { merge: true }
          );
        }
      }
    };

    for (const pendingSessionId of pendingSessionIds) {
      try {
        await linkSessionById(pendingSessionId, { forceRelink: true });
      } catch (linkError) {
        console.error(`Failed to link pending session ${pendingSessionId}:`, linkError);
      }
    }

    const summaryQueries = await Promise.all([
      db.collection('call-summaries').where('patientEmail', '==', userEmail).limit(200).get(),
      db
        .collection('call-summaries')
        .where('metadata.patientEmail', '==', userEmail)
        .limit(200)
        .get(),
    ]);

    const summaryDocs = new Map<string, any>();
    summaryQueries.forEach((snapshot) => {
      snapshot.docs.forEach((summaryDoc) => {
        summaryDocs.set(summaryDoc.id, summaryDoc);
      });
    });

    for (const summaryDoc of summaryDocs.values()) {
      try {
        const summaryData = summaryDoc.data() || {};
        const summaryDoctorUserId = summaryData.createdBy || summaryData.metadata?.createdBy;
        if (summaryDoctorUserId === userId) {
          continue;
        }

        const currentPatientUserId = summaryData.patientUserId || summaryData.metadata?.patientUserId;
        if (!canRelinkPatient(currentPatientUserId, userId)) {
          continue;
        }

        await summaryDoc.ref.set(
          {
            patientUserId: userId,
            patientEmail: userEmail,
            metadata: {
              ...(summaryData.metadata || {}),
              patientUserId: userId,
              patientEmail: userEmail,
            },
          },
          { merge: true }
        );
        linkedCount += 1;

        const summarySessionId =
          typeof summaryData.consultationSessionId === 'string' &&
          summaryData.consultationSessionId.trim()
            ? summaryData.consultationSessionId.trim()
            : summaryDoc.id.startsWith('sess_')
            ? summaryDoc.id
            : null;

        if (summarySessionId) {
          await linkSessionById(summarySessionId);
        }
      } catch (summaryLinkError) {
        console.error(`Failed to relink summary ${summaryDoc.id}:`, summaryLinkError);
      }
    }

    const invitationSnapshot = await db
      .collection('invitations')
      .where('emailAllowed', '==', userEmail)
      .limit(200)
      .get();

    const roomNames = Array.from(
      new Set(
        invitationSnapshot.docs
          .map((invitationDoc) => invitationDoc.data()?.roomName)
          .filter((roomName): roomName is string => typeof roomName === 'string' && roomName.trim().length > 0)
      )
    );

    for (const roomName of roomNames) {
      try {
        const consultationRef = db.collection('consultations').doc(roomName);
        const consultationDoc = await consultationRef.get();

        if (consultationDoc.exists) {
          const consultationData = consultationDoc.data() || {};
          const doctorUserId =
            consultationData.createdBy ||
            consultationData.metadata?.createdBy ||
            consultationData.metadata?.doctorUserId;

          if (doctorUserId !== userId) {
            const currentPatientUserId =
              consultationData.patientUserId || consultationData.metadata?.patientUserId;
            const visibleToUsers = mergeVisibleUsers(
              consultationData.metadata?.visibleToUsers,
              doctorUserId,
              userId
            );

            const updatePayload: Record<string, unknown> = {
              metadata: {
                ...(consultationData.metadata || {}),
                visibleToUsers,
              },
            };

            if (canRelinkPatient(currentPatientUserId, userId)) {
              updatePayload.patientUserId = userId;
              updatePayload.patientEmail = userEmail;
              (updatePayload.metadata as Record<string, unknown>).patientUserId = userId;
              (updatePayload.metadata as Record<string, unknown>).patientEmail = userEmail;
              linkedCount += 1;
            }

            await consultationRef.set(updatePayload, { merge: true });
          }
        }
      } catch (consultationLinkError) {
        console.error(`Failed to link consultation for room ${roomName}:`, consultationLinkError);
      }
    }

    return NextResponse.json({
      success: true,
      linkedCount,
      linkedSessionCount: linkedSessionIds.size,
      message: `Linked ${linkedCount} records and ${linkedSessionIds.size} sessions`,
    });
  } catch (error) {
    console.error('Link consultations error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to link consultations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { CallSummaryRepository } from '@/lib/repositories/call-summary-repository';
import { ConsultationRepository } from '@/lib/repositories/consultation-repository';
import { ConsultationSessionRepository } from '@/lib/repositories/consultation-session-repository';
import { InvitationRepository } from '@/lib/repositories/invitation-repository';

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

async function handlePOST(req: Request) {
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

    const summaryRepo = new CallSummaryRepository(db);
    const sessionRepo = new ConsultationSessionRepository(db);
    const consultationRepo = new ConsultationRepository(db);
    const invitationRepo = new InvitationRepository(db);
    let linkedCount = 0;
    const linkedSessionIds = new Set<string>();

    const linkSessionById = async (
      consultationSessionId: string,
      options?: { forceRelink?: boolean }
    ) => {
      const forceRelink = Boolean(options?.forceRelink);
      const sessionDoc = await sessionRepo.getById(consultationSessionId);
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

      await sessionRepo.mergeFields(consultationSessionId, {
        patientUserId: userId,
        metadata: {
          ...(sessionData.metadata || {}),
          patientUserId: userId,
          patientEmail: userEmail,
        },
        updatedAt: new Date(),
      });

      linkedSessionIds.add(consultationSessionId);
      linkedCount += 1;

      const roomName = sessionData.roomName;
      if (typeof roomName === 'string' && roomName.trim()) {
        const consultationDoc = await consultationRepo.getByRoom(roomName);
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

            await consultationRepo.mergeFields(roomName, {
              patientUserId: userId,
              patientEmail: userEmail,
              metadata: {
                ...(consultationData.metadata || {}),
                patientUserId: userId,
                patientEmail: userEmail,
                visibleToUsers,
              },
            });
          }
        }
      }

      const summaryDoc = await summaryRepo.getById(consultationSessionId);
      if (summaryDoc.exists) {
        const summaryData = summaryDoc.data() || {};
        const summaryDoctorUserId = summaryData.createdBy || summaryData.metadata?.createdBy;
        if (summaryDoctorUserId !== userId) {
          await summaryRepo.mergeFields(consultationSessionId, {
            patientUserId: userId,
            patientEmail: userEmail,
            metadata: {
              ...(summaryData.metadata || {}),
              patientUserId: userId,
              patientEmail: userEmail,
            },
          });
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

    const summaryDocsList = await summaryRepo.findByPatient({ emails: [userEmail] }, 200);

    for (const summaryDoc of summaryDocsList) {
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

        await summaryRepo.mergeFields(summaryDoc.id, {
          patientUserId: userId,
          patientEmail: userEmail,
          metadata: {
            ...(summaryData.metadata || {}),
            patientUserId: userId,
            patientEmail: userEmail,
          },
        });
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

    const sessionDocsFromEmail = await sessionRepo.findByPatient({ emails: [userEmail] }, 200);

    const sessionIdsFromEmail = new Set<string>();
    sessionDocsFromEmail.forEach((sessionDoc) => {
      const sessionData = sessionDoc.data() || {};
      const sessionId =
        typeof sessionData.consultationSessionId === 'string' && sessionData.consultationSessionId.trim()
          ? sessionData.consultationSessionId.trim()
          : sessionDoc.id;
      sessionIdsFromEmail.add(sessionId);
    });

    for (const sessionId of sessionIdsFromEmail) {
      try {
        await linkSessionById(sessionId, { forceRelink: true });
      } catch (sessionRelinkError) {
        console.error(`Failed to relink session ${sessionId}:`, sessionRelinkError);
      }
    }

    const invitationDocsByEmail = await invitationRepo.findByEmailAllowed(userEmail, 200);

    const roomNamesFromInvitations = Array.from(
      new Set(
        invitationDocsByEmail
          .map((invitationDoc) => invitationDoc.data()?.roomName)
          .filter((roomName): roomName is string => typeof roomName === 'string' && roomName.trim().length > 0)
      )
    );

    const consultationDocsByEmail = await consultationRepo.findByPatientEmail(userEmail, 200);

    const roomNamesFromConsultations = consultationDocsByEmail
      .map((consultationDoc) => consultationDoc.id)
      .filter((roomName): roomName is string => typeof roomName === 'string' && roomName.trim().length > 0);

    const roomNames = Array.from(new Set([...roomNamesFromInvitations, ...roomNamesFromConsultations]));

    for (const roomName of roomNames) {
      try {
        const consultationDoc = await consultationRepo.getByRoom(roomName);

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

            await consultationRepo.mergeFields(roomName, updatePayload);
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

export const POST = withRequestLogging(handlePOST);

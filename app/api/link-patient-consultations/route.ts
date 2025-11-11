import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { userId, userEmail } = await req.json();
    console.log(`Linking consultations for patient: ${userId}, email: ${userEmail}`);

    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'User ID and email are required' }, { status: 400 });
    }

    const db = getFirebaseAdmin();
    if (!db) {
      console.error('❌ Firebase Admin not initialized');
      return NextResponse.json({ 
        error: 'Firebase Admin not initialized',
        message: 'Please check your Firebase environment variables'
      }, { status: 500 });
    }

    let linkedCount = 0;

    try {
      // Find all invitations that match this patient's email
      const invitationsRef = db.collection('invitations');
      const invitationQuery = await invitationsRef
        .where('emailAllowed', '==', userEmail.toLowerCase().trim())
        .limit(100)
        .get();

      console.log(`Found ${invitationQuery.size} invitations for email: ${userEmail}`);

      // For each invitation, find consultations for that room and update them
      for (const invitationDoc of invitationQuery.docs) {
        const invitation = invitationDoc.data();
        const roomName = invitation.roomName;

        if (!roomName) continue;

        try {
          // Check if consultation exists for this room
          const consultationRef = db.collection('consultations').doc(roomName);
          const consultationDoc = await consultationRef.get();

          if (consultationDoc.exists) {
            const consultationData = consultationDoc.data();
            const currentPatientUserId = consultationData?.patientUserId || consultationData?.metadata?.patientUserId;
            const visibleToUsers = consultationData?.metadata?.visibleToUsers || [];
            const doctorUserId = consultationData?.createdBy || consultationData?.metadata?.createdBy || consultationData?.metadata?.doctorUserId;

            // Update if patientUserId is 'anonymous' or patient is not in visibleToUsers
            if ((currentPatientUserId === 'anonymous' || !currentPatientUserId || !visibleToUsers.includes(userId)) && userId !== doctorUserId) {
              const updatedVisibleToUsers = [...new Set([...visibleToUsers, userId, doctorUserId])].filter(
                (id) => id && id !== 'unknown' && id !== 'anonymous'
              );

              await consultationRef.update({
                patientUserId: userId,
                metadata: {
                  ...(consultationData?.metadata || {}),
                  patientUserId: userId,
                  visibleToUsers: updatedVisibleToUsers
                }
              });

              linkedCount++;
              console.log(`✅ Linked consultation ${roomName} to patient ${userId}`);
              
              // Also update call-summary if it exists to include patientUserId
              try {
                const summaryRef = db.collection('call-summaries').doc(roomName);
                const summaryDoc = await summaryRef.get();
                if (summaryDoc.exists) {
                  const summaryData = summaryDoc.data();
                  // Only update if patientUserId is missing or is anonymous/unknown
                  if (!summaryData?.patientUserId || summaryData.patientUserId === 'anonymous' || summaryData.patientUserId === 'unknown') {
                    const summaryUpdate: any = {
                      patientUserId: userId
                    };
                    if (summaryData?.metadata) {
                      summaryUpdate.metadata = {
                        ...summaryData.metadata,
                        patientUserId: userId
                      };
                    } else {
                      summaryUpdate.metadata = {
                        patientUserId: userId
                      };
                    }
                    await summaryRef.update(summaryUpdate);
                    console.log(`✅ Updated call-summary ${roomName} with patientUserId: ${userId}`);
                  }
                }
              } catch (summaryError) {
                console.error(`Error updating call-summary for room ${roomName}:`, summaryError);
                // Don't fail the whole operation if summary update fails
              }
            }
          }
        } catch (error) {
          console.error(`Error updating consultation for room ${roomName}:`, error);
        }
      }

      // Also check consultations that might have been created but invitation lookup failed
      // Query all consultations and check if they match any invitation for this email
      const consultationsRef = db.collection('consultations');
      const allConsultations = await consultationsRef.limit(500).get();

      for (const consultationDoc of allConsultations.docs) {
        const consultationData = consultationDoc.data();
        const roomName = consultationData.roomName || consultationDoc.id;
        const currentPatientUserId = consultationData?.patientUserId || consultationData?.metadata?.patientUserId;
        const visibleToUsers = consultationData?.metadata?.visibleToUsers || [];
        const doctorUserId = consultationData?.createdBy || consultationData?.metadata?.createdBy || consultationData?.metadata?.doctorUserId;

        // Skip if already linked to this patient
        if (currentPatientUserId === userId || visibleToUsers.includes(userId)) {
          continue;
        }

        // Check if there's an invitation for this room with this patient's email
        try {
          const invitationQuery = await invitationsRef
            .where('roomName', '==', roomName)
            .where('emailAllowed', '==', userEmail.toLowerCase().trim())
            .limit(1)
            .get();

          if (!invitationQuery.empty && userId !== doctorUserId) {
            // This consultation is for this patient - link it
            const updatedVisibleToUsers = [...new Set([...visibleToUsers, userId, doctorUserId])].filter(
              (id) => id && id !== 'unknown' && id !== 'anonymous'
            );

            await consultationDoc.ref.update({
              patientUserId: userId,
              metadata: {
                ...consultationData.metadata,
                patientUserId: userId,
                visibleToUsers: updatedVisibleToUsers
              }
            });

            linkedCount++;
            console.log(`✅ Linked consultation ${roomName} to patient ${userId} (found via consultation scan)`);
            
            // Also update call-summary if it exists to include patientUserId
            try {
              const summaryRef = db.collection('call-summaries').doc(roomName);
              const summaryDoc = await summaryRef.get();
              if (summaryDoc.exists) {
                const summaryData = summaryDoc.data();
                // Only update if patientUserId is missing or is anonymous/unknown
                if (!summaryData?.patientUserId || summaryData.patientUserId === 'anonymous' || summaryData.patientUserId === 'unknown') {
                  const summaryUpdate: any = {
                    patientUserId: userId
                  };
                  if (summaryData?.metadata) {
                    summaryUpdate.metadata = {
                      ...summaryData.metadata,
                      patientUserId: userId
                    };
                  } else {
                    summaryUpdate.metadata = {
                      patientUserId: userId
                    };
                  }
                  await summaryRef.update(summaryUpdate);
                  console.log(`✅ Updated call-summary ${roomName} with patientUserId: ${userId} (found via consultation scan)`);
                }
              }
            } catch (summaryError) {
              console.error(`Error updating call-summary for room ${roomName}:`, summaryError);
              // Don't fail the whole operation if summary update fails
            }
          }
        } catch (error) {
          console.error(`Error checking invitation for room ${roomName}:`, error);
        }
      }

      console.log(`✅ Linked ${linkedCount} consultations to patient ${userId}`);
      return NextResponse.json({ 
        success: true, 
        message: `Linked ${linkedCount} consultations`,
        linkedCount
      });

    } catch (error) {
      console.error('❌ Error linking consultations:', error);
      return NextResponse.json({ 
        error: 'Failed to link consultations',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Link consultations error:', error);
    return NextResponse.json({ 
      error: 'Failed to link consultations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


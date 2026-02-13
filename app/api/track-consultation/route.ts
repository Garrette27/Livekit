import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';
import { buildVisibleUserIds, choosePatientUserId, isKnownUserId } from '../../../lib/consultations/identity-utils';
import { generateAndStoreConsultationSummary } from '../../../lib/consultations/summary-service';

export async function POST(req: Request) {
  try {
    const { roomName, action, patientName, userId, patientEmail } = await req.json();
    console.log(`Track consultation: ${action} for room: ${roomName}, user: ${userId}, patientEmail: ${patientEmail}`);

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

    // Look up the room creator (doctor) to link the consultation to them
    let doctorUserId = 'unknown';
    try {
      const roomRef = db.collection('rooms').doc(roomName);
      const roomDoc = await roomRef.get();
      if (roomDoc.exists) {
        const roomData = roomDoc.data();
        doctorUserId = roomData?.createdBy || roomData?.metadata?.createdBy || 'unknown';
        console.log(`Found room creator: ${doctorUserId} for room: ${roomName}`);
      } else {
        console.log(`Room ${roomName} not found in rooms collection`);
      }
    } catch (error) {
      console.error('Error looking up room creator:', error);
    }

    // If userId is 'anonymous' or missing, try to look up patient by email
    // Also check if this is a doctor joining (should not set patientUserId to doctor's ID)
    let actualPatientUserId = userId || 'anonymous';
    let invitationEmailForPatient: string | null = null;
    
    // Don't set patientUserId to doctor's ID - only set if it's actually a patient
    if (userId && userId === doctorUserId && action === 'join') {
      // This is likely the doctor joining, not the patient
      // Don't set patientUserId to doctor's ID - keep it as 'anonymous' until patient joins
      actualPatientUserId = 'anonymous';
      console.log(`Doctor joining detected (userId matches doctorUserId), keeping patientUserId as anonymous`);
    } else {
      // Try multiple methods to find patient user ID
      
      // Method 1: If we have a userId and it's not the doctor, use it
      if (userId && userId !== doctorUserId && userId !== 'anonymous') {
        actualPatientUserId = userId;
        console.log(`Using provided user ID as patient: ${actualPatientUserId}`);
      }
      // Method 2: If we have patientEmail, look up by email
      else if (patientEmail) {
        try {
          const usersRef = db.collection('users');
          const userQuery = await usersRef.where('email', '==', patientEmail.toLowerCase().trim()).limit(1).get();
          if (!userQuery.empty) {
            const foundUserId = userQuery.docs[0].id;
            // Make sure we're not setting patientUserId to doctor's ID
            if (foundUserId !== doctorUserId) {
              actualPatientUserId = foundUserId;
              console.log(`Found patient user ID by email: ${actualPatientUserId} for email: ${patientEmail}`);
            } else {
              console.log(`Found user ID matches doctor ID, keeping patientUserId as anonymous`);
            }
          } else {
            console.log(`No user found with email: ${patientEmail}`);
          }
        } catch (error) {
          console.error('Error looking up patient by email:', error);
        }
      }
      
      // Method 3: If still anonymous, try to get email from invitation and look up user
      if (actualPatientUserId === 'anonymous' || !actualPatientUserId) {
        try {
          const invitationsRef = db.collection('invitations');
          // Find invitation for this room (try both active and used status)
          let invitationQuery = await invitationsRef
            .where('roomName', '==', roomName)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();
          
          // If no results with orderBy, try without (in case index not ready)
          if (invitationQuery.empty) {
            invitationQuery = await invitationsRef
              .where('roomName', '==', roomName)
              .limit(5)
              .get();
          }
          
          if (!invitationQuery.empty) {
            // Get the most recent invitation
            const invitation = invitationQuery.docs[0].data();
            invitationEmailForPatient = invitation?.emailAllowed || invitation?.metadata?.constraints?.email || null;
            if (invitationEmailForPatient) {
              console.log(`Found invitation email for room ${roomName}: ${invitationEmailForPatient}`);
              // Look up user by invitation email
              const usersRef = db.collection('users');
              const userQuery = await usersRef.where('email', '==', invitationEmailForPatient.toLowerCase().trim()).limit(1).get();
              if (!userQuery.empty) {
                const foundUserId = userQuery.docs[0].id;
                if (foundUserId !== doctorUserId) {
                  actualPatientUserId = foundUserId;
                  console.log(`Found patient user ID from invitation email: ${actualPatientUserId} for email: ${invitationEmailForPatient}`);
                } else {
                  console.log(`Found user ID from invitation matches doctor ID, keeping patientUserId as anonymous`);
                }
              } else {
                console.log(`No user found with invitation email: ${invitationEmailForPatient} - patient may not be registered yet, but will store email`);
              }
            }
          } else {
            console.log(`No invitation found for room: ${roomName}`);
          }
        } catch (error) {
          console.error('Error looking up patient from invitation:', error);
        }
      }
    }

    const consultationRef = db.collection('consultations').doc(roomName);
    
    if (action === 'join') {
      // Check if consultation already exists
      const consultationDoc = await consultationRef.get();
      const existingData = consultationDoc.exists ? consultationDoc.data() : null;
      
      // Preserve existing patient email/userId if we're getting anonymous values
      // Only update if we have a better (non-anonymous, non-null) value
      const existingPatientUserId = existingData?.patientUserId || existingData?.metadata?.patientUserId;
      const existingPatientEmail = existingData?.patientEmail || existingData?.metadata?.patientEmail;
      
      // If consultation exists and patientUserId is 'anonymous' but we now have a real user ID, update it
      if (existingData && existingPatientUserId === 'anonymous' && isKnownUserId(actualPatientUserId) && actualPatientUserId !== doctorUserId) {
        console.log(`Updating existing consultation with patient user ID: ${actualPatientUserId}`);
        const existingVisibleToUsers = existingData.metadata?.visibleToUsers || [];
        const updatedVisibleToUsers = buildVisibleUserIds(doctorUserId, actualPatientUserId, existingVisibleToUsers);
        
        await consultationRef.update({
          patientUserId: actualPatientUserId,
          metadata: {
            ...existingData.metadata,
            patientUserId: actualPatientUserId,
            visibleToUsers: updatedVisibleToUsers
          }
        });
        
        console.log(`✅ Updated consultation ${roomName} with patient user ID: ${actualPatientUserId}`);
      } else {
        // Get patient email if available
        let patientEmailToStore = null;
        if (patientEmail) {
          patientEmailToStore = patientEmail;
        } else if (isKnownUserId(actualPatientUserId)) {
          // Try to get email from user document
          try {
            const userDoc = await db.collection('users').doc(actualPatientUserId).get();
            if (userDoc.exists) {
              patientEmailToStore = userDoc.data()?.email || null;
            }
          } catch (error) {
            console.error('Error fetching patient email from user document:', error);
          }
        } else if (invitationEmailForPatient) {
          // If patient is anonymous but invitation has email, use invitation email
          patientEmailToStore = invitationEmailForPatient;
          console.log(`Storing invitation email as patient email: ${invitationEmailForPatient}`);
        }
        
        // Preserve existing patient email/userId if joining anonymously
        // Only use new values if they're better (non-anonymous, non-null)
        const finalPatientUserId = choosePatientUserId(actualPatientUserId, existingPatientUserId);
        
        const finalPatientEmail = (!patientEmailToStore && existingPatientEmail)
          ? existingPatientEmail  // Preserve existing patient email
          : patientEmailToStore;  // Use new email (or null if anonymous)
        
        // Determine if we should preserve existing joinedAt timestamp
        // Only preserve if consultation is active and joinedAt is recent (within 3 hours)
        // If consultation is completed or joinedAt is too old, reset it
        let finalJoinedAt: Date;
        if (existingData?.joinedAt) {
          const existingStatus = existingData?.status;
          const existingJoinedAt = existingData.joinedAt.toDate ? existingData.joinedAt.toDate() : new Date(existingData.joinedAt);
          const now = new Date();
          const hoursSinceJoined = (now.getTime() - existingJoinedAt.getTime()) / (1000 * 60 * 60); // Convert to hours
          
          // Only preserve joinedAt if:
          // 1. Consultation is active (not completed)
          // 2. JoinedAt is recent (within 3 hours) - handles brief disconnections
          if (existingStatus === 'active' && hoursSinceJoined < 3) {
            finalJoinedAt = existingJoinedAt;
            console.log(`ℹ️ Preserving existing joinedAt (${hoursSinceJoined.toFixed(2)} hours ago) for active consultation`);
          } else {
            // Consultation is completed or joinedAt is too old - reset it
            finalJoinedAt = new Date();
            if (existingStatus === 'completed') {
              console.log(`ℹ️ Resetting joinedAt - consultation was already completed`);
            } else {
              console.log(`ℹ️ Resetting joinedAt - too old (${hoursSinceJoined.toFixed(2)} hours ago)`);
            }
          }
        } else {
          // No existing joinedAt - use current time
          finalJoinedAt = new Date();
        }
        
        // Track when patient joins (new consultation or update existing)
        const consultationData: any = {
          roomName,
          patientName: patientName || existingData?.patientName || 'Unknown Patient',
          joinedAt: finalJoinedAt,
          status: 'active',
          isRealConsultation: true, // Mark as real consultation, not test
          createdBy: doctorUserId, // Store doctor's user ID for doctor's view
          patientUserId: finalPatientUserId, // Use preserved or new patient user ID
          metadata: {
            source: 'patient_join',
            trackedAt: new Date(),
            createdBy: doctorUserId,
            patientUserId: finalPatientUserId, // Use preserved or new patient user ID
            doctorUserId: doctorUserId, // Explicitly store doctor's user ID
            // Add both user IDs so both can see the consultation (remove duplicates)
            visibleToUsers: buildVisibleUserIds(doctorUserId, finalPatientUserId)
          }
        };
        
        // Only set patient email if we have a value (preserve existing or use new)
        if (finalPatientEmail) {
          consultationData.patientEmail = finalPatientEmail;
          consultationData.metadata.patientEmail = finalPatientEmail;
        }
        
        await consultationRef.set(consultationData, { merge: true });
        
        console.log(`✅ Patient joined consultation: ${roomName}, linked to doctor: ${doctorUserId}, patient: ${finalPatientUserId}, email: ${finalPatientEmail || 'not available'}`);
        if (actualPatientUserId === 'anonymous' && existingPatientEmail) {
          console.log(`ℹ️ Preserved existing patient email (${existingPatientEmail}) when patient joined anonymously`);
        }
        console.log('Consultation data stored:', consultationData);
      }
      
    } else if (action === 'leave') {
      // Track when patient leaves and calculate duration
      const consultationDoc = await consultationRef.get();
      if (consultationDoc.exists) {
        const data = consultationDoc.data();
        const joinedAt = data?.joinedAt?.toDate() || new Date();
        const leftAt = new Date();
        const durationMinutes = Math.round((leftAt.getTime() - joinedAt.getTime()) / (1000 * 60));
        
        // Preserve existing patient email/userId if leaving anonymously
        // Get existing patient data from consultation
        const existingPatientUserId = data?.patientUserId || data?.metadata?.patientUserId;
        const existingPatientEmail = data?.patientEmail || data?.metadata?.patientEmail;
        
        // Preserve existing patientUserId if leaving anonymously and existing is better
        const finalPatientUserId = choosePatientUserId(actualPatientUserId, existingPatientUserId);
        
        // Get patient email from consultation data or request (preserve existing if available)
        const patientEmailToStore = existingPatientEmail || patientEmail || null;
        
        const updateData: any = {
          leftAt,
          duration: durationMinutes,
          status: 'completed',
          isRealConsultation: true,
          createdBy: doctorUserId, // Ensure doctor's user ID is preserved
          patientUserId: finalPatientUserId, // Use preserved or current patient user ID
          metadata: {
            ...data?.metadata,
            source: 'patient_leave',
            durationMinutes,
            trackedAt: new Date(),
            createdBy: doctorUserId,
            patientUserId: finalPatientUserId, // Use preserved or current patient user ID
            doctorUserId: doctorUserId,
            // Add both user IDs so both can see the consultation (remove duplicates)
            visibleToUsers: buildVisibleUserIds(doctorUserId, finalPatientUserId)
          }
        };
        
        // Add patient email if available (preserve existing)
        if (patientEmailToStore) {
          updateData.patientEmail = patientEmailToStore;
          updateData.metadata.patientEmail = patientEmailToStore;
          console.log('✅ Storing patient email in consultation:', patientEmailToStore);
          if (actualPatientUserId === 'anonymous' && existingPatientEmail) {
            console.log(`ℹ️ Preserved existing patient email (${existingPatientEmail}) when patient left anonymously`);
          }
        }
        
        await consultationRef.update(updateData);
        
        console.log(`✅ Patient left consultation: ${roomName}, duration: ${durationMinutes} minutes, linked to doctor: ${doctorUserId}`);
        
        // Generate AI summary for completed consultation
        try {
          console.log(`Generating AI summary for room: ${roomName}, patient: ${data?.patientName || 'Unknown Patient'}, duration: ${durationMinutes}, doctor: ${doctorUserId}`);
          
          // Get patient email from consultation data (use preserved email)
          const patientEmailFromConsultation = patientEmailToStore || patientEmail || null;
          
          // Try to get transcription data from the calls collection
          let transcriptionData = null;
          try {
            const callRef = db.collection('calls').doc(roomName);
            const callDoc = await callRef.get();
            if (callDoc.exists) {
              const callData = callDoc.data();
              transcriptionData = callData?.transcription || [];
              console.log('Found transcription data for summary:', transcriptionData.length, 'entries');
            }
          } catch (transcriptionError) {
            console.log('Could not fetch transcription data:', transcriptionError);
          }
          
          await generateAndStoreConsultationSummary({
            roomName,
            patientName: data?.patientName || 'Unknown Patient',
            durationMinutes,
            userId: doctorUserId,
            transcriptionData,
            patientUserId: finalPatientUserId, // Use preserved patient user ID
            patientEmail: patientEmailFromConsultation // Use preserved patient email
          });
        } catch (error) {
          console.error('❌ Error generating consultation summary:', error);
        }
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



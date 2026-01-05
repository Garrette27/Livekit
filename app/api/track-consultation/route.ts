import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { roomName, action, patientName, duration, userId, patientEmail } = await req.json();
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
      if (existingData && existingPatientUserId === 'anonymous' && actualPatientUserId !== 'anonymous' && actualPatientUserId !== doctorUserId) {
        console.log(`Updating existing consultation with patient user ID: ${actualPatientUserId}`);
        const existingVisibleToUsers = existingData.metadata?.visibleToUsers || [];
        const updatedVisibleToUsers = [...new Set([...existingVisibleToUsers, doctorUserId, actualPatientUserId])].filter(
          (id) => id !== 'unknown' && id !== 'anonymous'
        );
        
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
        } else if (actualPatientUserId && actualPatientUserId !== 'anonymous' && actualPatientUserId !== 'unknown') {
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
        const finalPatientUserId = (actualPatientUserId === 'anonymous' || actualPatientUserId === 'unknown') && 
                                   existingPatientUserId && 
                                   existingPatientUserId !== 'anonymous' && 
                                   existingPatientUserId !== 'unknown'
          ? existingPatientUserId  // Preserve existing valid patientUserId
          : actualPatientUserId;    // Use new patientUserId (or anonymous if no existing)
        
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
            visibleToUsers: [doctorUserId, finalPatientUserId].filter((id, index, self) => 
              id !== 'unknown' && id !== 'anonymous' && self.indexOf(id) === index
            )
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
        const finalPatientUserId = (actualPatientUserId === 'anonymous' || actualPatientUserId === 'unknown') && 
                                   existingPatientUserId && 
                                   existingPatientUserId !== 'anonymous' && 
                                   existingPatientUserId !== 'unknown'
          ? existingPatientUserId  // Preserve existing valid patientUserId
          : actualPatientUserId;    // Use current patientUserId (or anonymous if no existing)
        
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
            visibleToUsers: [doctorUserId, finalPatientUserId].filter((id, index, self) => 
              id !== 'unknown' && id !== 'anonymous' && self.indexOf(id) === index
            )
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
          
          await generateConsultationSummary(
            roomName, 
            data?.patientName || 'Unknown Patient', 
            durationMinutes, 
            doctorUserId, 
            transcriptionData,
            finalPatientUserId, // Use preserved patient user ID
            patientEmailFromConsultation // Use preserved patient email
          );
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

async function generateConsultationSummary(
  roomName: string, 
  patientName: string, 
  durationMinutes: number, 
  userId: string, 
  transcriptionData: any[] | null = null,
  patientUserId: string | null = null,
  patientEmail: string | null = null
) {
  try {
    console.log('Generating AI summary for consultation:', roomName, 'with user ID:', userId);
    
    const db = getFirebaseAdmin();
    if (!db) {
      console.error('❌ Firebase Admin not initialized for summary generation');
      return;
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ OpenAI API key not configured, using fallback summary');
      
      // Store fallback summary
      const summaryData: any = {
        roomName,
        summary: `Consultation completed with ${patientName}. Duration: ${durationMinutes} minutes. No AI analysis available - OpenAI not configured.`,
        keyPoints: ['Consultation completed', 'Duration recorded', 'No AI analysis available'],
        recommendations: ['Please configure OpenAI API for enhanced summaries'],
        followUpActions: ['Manual review required'],
        riskLevel: 'Unknown',
        category: 'General Consultation',
        participants: [patientName],
        duration: durationMinutes,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          totalParticipants: 1,
          createdBy: userId,
          source: 'consultation_tracking',
          hasTranscriptionData: transcriptionData && transcriptionData.length > 0,
          transcriptionEntries: transcriptionData ? transcriptionData.length : 0,
          summaryGeneratedAt: new Date()
        }
      };
      
      // Add patient information if available
      if (patientUserId && patientUserId !== 'anonymous' && patientUserId !== 'unknown') {
        summaryData.patientUserId = patientUserId;
        summaryData.metadata.patientUserId = patientUserId;
      }
      
      if (patientEmail) {
        summaryData.patientEmail = patientEmail;
        summaryData.metadata.patientEmail = patientEmail;
        console.log('✅ Storing patient email in fallback summary:', patientEmail);
      }

      const summaryRef = db.collection('call-summaries').doc(roomName);
      await summaryRef.set(summaryData);
      console.log('✅ Fallback summary stored successfully with user ID:', userId);
      console.log('Fallback summary data:', { roomName, createdBy: summaryData.createdBy, metadata: summaryData.metadata });
      return;
    }

    console.log('✅ OpenAI API key found, generating AI summary...');

    // Prepare conversation context for AI
    let conversationContext = '';
    if (transcriptionData && transcriptionData.length > 0) {
      conversationContext = `\n\nActual conversation transcript:\n${transcriptionData.join('\n')}`;
    } else {
      conversationContext = '\n\nNo conversation transcript available. This may be a video-only consultation or transcription was not enabled.';
    }

    // Create a comprehensive prompt for medical consultation summarization
    const prompt = `You are a medical AI assistant specializing in summarizing telehealth consultations. 
    
    Generate a comprehensive, structured summary for a medical consultation that took place in room: ${roomName}.
    
    Consultation details:
    - Duration: ${durationMinutes} minutes
    - Patient: ${patientName}
    ${conversationContext}
    
    Please provide the following structured response in JSON format:
    
    {
      "summary": "A concise 2-3 sentence overview of the consultation based on the actual conversation content",
      "keyPoints": ["List of 3-5 main topics discussed", "Important symptoms mentioned", "Key findings from the conversation"],
      "recommendations": ["List of 2-4 recommendations made by the doctor", "Prescriptions if any", "Lifestyle advice"],
      "followUpActions": ["List of 2-3 follow-up actions needed", "Appointment scheduling", "Tests required"],
      "riskLevel": "Low/Medium/High based on the consultation content",
      "category": "Primary Care/Specialist/Emergency/Follow-up/General Consultation"
    }
    
    IMPORTANT: Base your summary on the actual conversation content provided. If no conversation transcript is available, indicate this clearly in the summary.
    
    Focus on medical accuracy, patient privacy, and actionable insights.`;

    console.log('Calling OpenAI API for consultation summary...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a medical AI assistant that provides structured, professional summaries of telehealth consultations. Always respond with valid JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';
    console.log('OpenAI response received:', content);
    
    try {
      // Clean the content - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Parse the JSON response
      const parsedSummary = JSON.parse(cleanContent);
      console.log('✅ Successfully parsed AI response');
      
      // Store the summary in Firestore
      const summaryData: any = {
        roomName,
        summary: parsedSummary.summary || 'Summary generation failed',
        keyPoints: parsedSummary.keyPoints || ['No key points available'],
        recommendations: parsedSummary.recommendations || ['No recommendations available'],
        followUpActions: parsedSummary.followUpActions || ['No follow-up actions specified'],
        riskLevel: parsedSummary.riskLevel || 'Unknown',
        category: parsedSummary.category || 'General Consultation',
        participants: [patientName],
        duration: durationMinutes,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          totalParticipants: 1,
          createdBy: userId,
          source: 'consultation_tracking',
          hasTranscriptionData: transcriptionData && transcriptionData.length > 0,
          transcriptionEntries: transcriptionData ? transcriptionData.length : 0,
          summaryGeneratedAt: new Date()
        }
      };
      
      // Add patient information if available
      if (patientUserId && patientUserId !== 'anonymous' && patientUserId !== 'unknown') {
        summaryData.patientUserId = patientUserId;
        summaryData.metadata.patientUserId = patientUserId;
      }
      
      if (patientEmail) {
        summaryData.patientEmail = patientEmail;
        summaryData.metadata.patientEmail = patientEmail;
        console.log('✅ Storing patient email in AI summary:', patientEmail);
      }

      const summaryRef = db.collection('call-summaries').doc(roomName);
      await summaryRef.set(summaryData);
      console.log('✅ AI summary stored successfully in Firestore with user ID:', userId);
      console.log('Summary data:', { roomName, createdBy: summaryData.createdBy, metadata: summaryData.metadata });
      
    } catch (parseError) {
      console.error('❌ Error parsing AI response:', parseError);
      
      // Store fallback summary
      const summaryData = {
        roomName,
        summary: content || 'Summary generation failed',
        keyPoints: ['Unable to parse structured data'],
        recommendations: ['Manual review recommended'],
        followUpActions: ['Contact support if needed'],
        riskLevel: 'Unknown',
        category: 'General Consultation',
        participants: [patientName],
        duration: durationMinutes,
        createdAt: new Date(),
        createdBy: userId,
        metadata: {
          totalParticipants: 1,
          createdBy: userId,
          source: 'consultation_tracking',
          hasTranscriptionData: transcriptionData && transcriptionData.length > 0,
          transcriptionEntries: transcriptionData ? transcriptionData.length : 0,
          summaryGeneratedAt: new Date()
        }
      };

      const summaryRef = db.collection('call-summaries').doc(roomName);
      await summaryRef.set(summaryData);
      console.log('✅ Parse error fallback summary stored successfully with user ID:', userId);
      console.log('Parse error fallback summary data:', { roomName, createdBy: summaryData.createdBy, metadata: summaryData.metadata });
    }
    
  } catch (error) {
    console.error('❌ Error generating consultation summary:', error);
    
    // Store error summary
    try {
      const db = getFirebaseAdmin();
      if (db) {
        const summaryData = {
          roomName,
          summary: 'Error generating AI summary',
          keyPoints: ['Summary generation failed'],
          recommendations: ['Manual review required'],
          followUpActions: ['Contact technical support'],
          riskLevel: 'Unknown',
          category: 'General Consultation',
          participants: [patientName],
          duration: durationMinutes,
          createdAt: new Date(),
          createdBy: userId,
          metadata: {
            totalParticipants: 1,
            createdBy: userId,
            source: 'consultation_tracking',
            hasTranscriptionData: transcriptionData && transcriptionData.length > 0,
            transcriptionEntries: transcriptionData ? transcriptionData.length : 0,
            summaryGeneratedAt: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        };

        const summaryRef = db.collection('call-summaries').doc(roomName);
        await summaryRef.set(summaryData);
        console.log('✅ Error summary stored successfully with user ID:', userId);
        console.log('Error summary data:', { roomName, createdBy: summaryData.createdBy, metadata: summaryData.metadata });
      }
    } catch (storeError) {
      console.error('❌ Error storing error summary:', storeError);
    }
  }
}

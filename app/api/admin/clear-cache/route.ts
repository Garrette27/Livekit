import { withRequestLogging } from '@/lib/services/shared/request-logging';
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { authorizeAdminSecret } from '@/lib/services/shared/admin-secret-auth';
import { serviceResultToResponse } from '@/lib/services/shared/http';

// Firebase config should be in environment variables
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  // Add other required config from env
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function handlePOST(request: NextRequest) {
  try {
    // Security check - only allow admin users
    const authorization = authorizeAdminSecret(request);
    if (!authorization.ok) {
      return serviceResultToResponse(authorization);
    }

    console.log('Clearing Firestore cache...');
    
    // Clear invitations collection
    const invitationsSnapshot = await getDocs(collection(db, 'invitations'));
    
    for (const document of invitationsSnapshot.docs) {
      await deleteDoc(doc(db, 'invitations', document.id));
      console.log(`Deleted invitation: ${document.id}`);
    }
    
    // Clear waiting-patients collection
    const waitingPatientsSnapshot = await getDocs(collection(db, 'waiting-patients'));
    
    for (const document of waitingPatientsSnapshot.docs) {
      await deleteDoc(doc(db, 'waiting-patients', document.id));
      console.log(`Deleted waiting patient: ${document.id}`);
    }
    
    console.log('Firestore cache cleared successfully!');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Firestore cache cleared successfully',
      deletedInvitations: invitationsSnapshot.size,
      deletedWaitingPatients: waitingPatientsSnapshot.size
    });
    
  } catch (error) {
    console.error('Error clearing Firestore cache:', error);
    return NextResponse.json({ 
      error: 'Failed to clear Firestore cache',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export const POST = withRequestLogging(handlePOST);

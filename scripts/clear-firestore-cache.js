const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc, query, where, Timestamp } = require('firebase/firestore');

// Initialize Firebase with your config
const firebaseConfig = {
  // Add your Firebase config here or use environment variables
  projectId: process.env.FIREBASE_PROJECT_ID || 'your-project-id',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearExpiredInvitations() {
  try {
    console.log('Clearing expired invitations...');
    
    // Get current time
    const now = new Date();
    
    // Get all invitations
    const invitationsSnapshot = await getDocs(collection(db, 'invitations'));
    
    let deletedCount = 0;
    
    for (const document of invitationsSnapshot.docs) {
      const invitation = document.data();
      
      // Check if invitation is expired
      let expiresAtDate;
      if (invitation.expiresAt && typeof invitation.expiresAt.toDate === 'function') {
        expiresAtDate = invitation.expiresAt.toDate();
      } else if (invitation.expiresAt instanceof Date) {
        expiresAtDate = invitation.expiresAt;
      } else {
        expiresAtDate = new Date((invitation.expiresAt?.seconds || 0) * 1000);
      }
      
      if (now > expiresAtDate) {
        await deleteDoc(doc(db, 'invitations', document.id));
        console.log(`Deleted expired invitation: ${document.id} (expired: ${expiresAtDate.toISOString()})`);
        deletedCount++;
      }
    }
    
    console.log(`Cleared ${deletedCount} expired invitations!`);
    
  } catch (error) {
    console.error('Error clearing expired invitations:', error);
  }
}

async function clearWaitingPatients() {
  try {
    console.log('Clearing waiting patients...');
    
    const waitingPatientsSnapshot = await getDocs(collection(db, 'waitingPatients'));
    
    for (const document of waitingPatientsSnapshot.docs) {
      await deleteDoc(doc(db, 'waitingPatients', document.id));
      console.log(`Deleted waiting patient: ${document.id}`);
    }
    
    console.log('All waiting patients cleared successfully!');
    
  } catch (error) {
    console.error('Error clearing waiting patients:', error);
  }
}

async function clearFirestoreCache() {
  try {
    console.log('Starting Firestore cache cleanup...');
    
    await clearExpiredInvitations();
    await clearWaitingPatients();
    
    console.log('Firestore cache cleanup completed!');
    
  } catch (error) {
    console.error('Error during cache cleanup:', error);
  }
}

clearFirestoreCache();

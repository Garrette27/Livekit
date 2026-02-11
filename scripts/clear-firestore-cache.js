const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

// Initialize Firebase with your config
const firebaseConfig = {
  // Add your Firebase config here
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearFirestoreCache() {
  try {
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
    
  } catch (error) {
    console.error('Error clearing Firestore cache:', error);
  }
}

clearFirestoreCache();

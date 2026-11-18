/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { after, before, beforeEach, test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, serverTimestamp } = require('firebase/firestore');
const { getBytes, ref, uploadBytes } = require('firebase/storage');

let rulesEnvironment;

/**
 * Exercise the deployed authorization boundary against the official Firebase
 * emulators. Server-only collections must stay inaccessible even to a future
 * reviewer claim, while an owner can use the narrow clinical paths intended
 * for browser access.
 */
before(async () => {
  rulesEnvironment = await initializeTestEnvironment({
    projectId: 'demo-livekit-security',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
    },
    storage: {
      rules: readFileSync(resolve(__dirname, '../../storage.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await rulesEnvironment.clearFirestore();
  await rulesEnvironment.clearStorage();
});

after(async () => {
  await rulesEnvironment.cleanup();
});

test('server-owned operational collections deny every client role', async () => {
  const reviewer = rulesEnvironment.authenticatedContext('reviewer-1', {
    role: 'faculty_reviewer',
  });
  const reviewerDb = reviewer.firestore();

  await assertFails(getDoc(doc(reviewerDb, 'reviewAssignments/assignment-1')));
  await assertFails(getDoc(doc(reviewerDb, 'summaryJobs/job-1')));
  await assertFails(setDoc(doc(reviewerDb, 'securityRateLimits/counter-1'), {
    count: 1,
  }));
});

test('summary ownership permits the doctor and denies a patient', async () => {
  await rulesEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'call-summaries/summary-1'), {
      createdBy: 'doctor-1',
      summaryStatus: 'ready',
    });
  });

  const doctorDb = rulesEnvironment.authenticatedContext('doctor-1', {
    role: 'doctor',
  }).firestore();
  const patientDb = rulesEnvironment.authenticatedContext('patient-1', {
    role: 'patient',
  }).firestore();

  await assertSucceeds(getDoc(doc(doctorDb, 'call-summaries/summary-1')));
  await assertFails(getDoc(doc(patientDb, 'call-summaries/summary-1')));
});

test('a user cannot elevate their own role', async () => {
  await rulesEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/patient-1'), {
      email: 'patient@example.test',
      role: 'patient',
    });
  });

  const patientDb = rulesEnvironment.authenticatedContext('patient-1', {
    role: 'patient',
  }).firestore();
  await assertFails(setDoc(doc(patientDb, 'users/patient-1'), {
    email: 'patient@example.test',
    role: 'faculty_reviewer',
  }));
});

test('disabled attachments deny even owner uploads', async () => {
  const doctorStorage = rulesEnvironment.authenticatedContext('doctor-1', {
    role: 'doctor',
  }).storage();
  const otherStorage = rulesEnvironment.authenticatedContext('doctor-2', {
    role: 'doctor',
  }).storage();
  const path = 'notes/doctor-1/room-1/note.png';

  await assertFails(uploadBytes(
    ref(doctorStorage, path),
    new Uint8Array([137, 80, 78, 71]),
    { contentType: 'image/png' }
  ));
  await assertFails(getBytes(ref(otherStorage, path)));
  await assertFails(uploadBytes(
    ref(doctorStorage, 'notes/doctor-1/room-1/script.html'),
    new TextEncoder().encode('<script>alert(1)</script>'),
    { contentType: 'text/html' }
  ));

});

test('private profiles allow owner reads but deny other users and listing', async () => {
  await rulesEnvironment.withSecurityRulesDisabled(async c => {
    await setDoc(doc(c.firestore(), 'users/patient-1'), {email:'patient@example.test',role:'patient'});
  });
  const owner = rulesEnvironment.authenticatedContext('patient-1').firestore();
  const other = rulesEnvironment.authenticatedContext('patient-2').firestore();
  await assertSucceeds(getDoc(doc(owner,'users/patient-1')));
  await assertFails(getDoc(doc(other,'users/patient-1')));
  await assertFails(getDocs(collection(other,'users')));
  await assertFails(getDoc(doc(rulesEnvironment.unauthenticatedContext().firestore(),'users/patient-1')));
});

test('profile updates cannot inject authority, consent, or change identity', async () => {
  await rulesEnvironment.withSecurityRulesDisabled(async c => {
    await setDoc(doc(c.firestore(), 'users/patient-1'), {email:'patient@example.test',role:'patient',legacyField:'preserved'});
  });
  const db = rulesEnvironment.authenticatedContext('patient-1',{email:'patient@example.test'}).firestore();
  const target = doc(db,'users/patient-1');
  for (const patch of [{role:'doctor'}, {role:'admin'}, {admin:true}, {permissions:['all']}, {email:'other@example.test'}, {consentVersion:'forged'}, {lastLoginAt:'bad'}, {extra:'x'.repeat(100000)}]) {
    await assertFails(updateDoc(target,patch));
  }
  await assertFails(deleteDoc(target));
  await assertSucceeds(updateDoc(target,{lastLoginAt:serverTimestamp()}));
});

test('only trusted claims can provision clinician profiles', async () => {
  const patientDb = rulesEnvironment.authenticatedContext('new-patient',{email:'patient@example.test'}).firestore();
  await assertFails(setDoc(doc(patientDb,'users/new-patient'),{email:'patient@example.test',role:'doctor'}));
  await assertFails(setDoc(doc(patientDb,'users/new-patient'),{email:'spoof@example.test',role:'patient'}));
  await assertFails(setDoc(doc(patientDb,'users/new-patient'),{email:'patient@example.test',role:'patient',admin:true}));
  await assertSucceeds(setDoc(doc(patientDb,'users/new-patient'),{email:'patient@example.test',role:'patient',consentGiven:false,registeredAt:serverTimestamp()}));
  const doctorDb=rulesEnvironment.authenticatedContext('new-doctor',{email:'doctor@example.test',role:'doctor'}).firestore();
  await assertSucceeds(setDoc(doc(doctorDb,'users/new-doctor'),{email:'doctor@example.test',role:'doctor',doctorName:'Synthetic Doctor',doctorEmail:'doctor@example.test',registeredAt:serverTimestamp()}));
});


test('live queue queries return only the signed-in doctor’s waiting and admitted visits', async () => {
  await rulesEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [id, doctorUserId, status] of [
      ['waiting-1', 'doctor-1', 'waiting'],
      ['admitted-1', 'doctor-1', 'admitted'],
      ['left-1', 'doctor-1', 'left'],
      ['waiting-2', 'doctor-2', 'waiting'],
    ]) {
      await setDoc(doc(db, 'waitingPatients', id), { doctorUserId, status });
    }
  });
  const doctorDb = rulesEnvironment.authenticatedContext('doctor-1', { role: 'doctor' }).firestore();
  const rows = collection(doctorDb, 'waitingPatients');
  const liveStatuses = where('status', 'in', ['waiting', 'admitted']);
  const snapshot = await assertSucceeds(getDocs(query(rows, where('doctorUserId', '==', 'doctor-1'), liveStatuses)));
  assert.deepEqual(snapshot.docs.map(row => row.id).sort(), ['admitted-1', 'waiting-1']);
  await assertFails(getDocs(query(rows, where('doctorUserId', '==', 'doctor-2'), liveStatuses)));
});

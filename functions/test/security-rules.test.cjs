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

test('consultation creation requires the server, including when the client names another patient', async () => {
  const clients = [
    rulesEnvironment.authenticatedContext('patient-1', { role: 'patient' }),
    rulesEnvironment.authenticatedContext('doctor-1', { role: 'doctor' }),
    rulesEnvironment.authenticatedContext('reviewer-1', { role: 'faculty_reviewer' }),
    rulesEnvironment.authenticatedContext('admin-1', { role: 'admin', admin: true }),
    rulesEnvironment.unauthenticatedContext(),
  ];
  for (const [index, context] of clients.entries()) {
    const db = context.firestore();
    const createdBy = ['patient-1', 'doctor-1', 'reviewer-1', 'admin-1', 'guest-1'][index];
    await assertFails(setDoc(doc(db, 'consultations', `forged-${index}`), {
      createdBy,
      patientUserId: 'patient-2',
      status: 'completed',
    }));
    await assertFails(setDoc(doc(db, 'consultations', `self-${index}`), {
      createdBy,
      patientUserId: createdBy,
      status: 'active',
    }));
  }
});

test('consultation owners and participants cannot rewrite identities, visibility, or lifecycle', async () => {
  const original = {
    createdBy: 'doctor-1',
    patientUserId: 'patient-1',
    status: 'active',
    metadata: { createdBy: 'doctor-1', visibleToUsers: ['patient-1'] },
  };
  await rulesEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'consultations/encounter-1'), original);
  });
  for (const [uid, claims] of [
    ['doctor-1', { role: 'doctor' }],
    ['patient-1', { role: 'patient' }],
    ['admin-1', { role: 'admin', admin: true }],
  ]) {
    const target = doc(rulesEnvironment.authenticatedContext(uid, claims).firestore(), 'consultations/encounter-1');
    for (const patch of [
      { createdBy: 'doctor-2' },
      { patientUserId: 'patient-2' },
      { 'metadata.createdBy': 'doctor-2' },
      { 'metadata.visibleToUsers': ['patient-2'] },
      { status: 'completed' },
      { extra: 'x'.repeat(100_000) },
    ]) {
      await assertFails(updateDoc(target, patch));
    }
    await assertFails(setDoc(target, { patientUserId: 'patient-2' }, { merge: true }));
    await assertFails(setDoc(target, { createdBy: uid, patientUserId: 'patient-2' }));
  }
  await rulesEnvironment.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDoc(doc(context.firestore(), 'consultations/encounter-1'));
    assert.deepEqual(snapshot.data(), original);
  });
});

test('even a consultation owner must use the server to delete an encounter', async () => {
  await rulesEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'consultations/encounter-1'), {
      createdBy: 'doctor-1', patientUserId: 'patient-1',
    });
  });
  for (const [uid, role] of [['doctor-1', 'doctor'], ['patient-1', 'patient'], ['doctor-2', 'doctor']]) {
    const db = rulesEnvironment.authenticatedContext(uid, { role }).firestore();
    await assertFails(deleteDoc(doc(db, 'consultations/encounter-1')));
  }
});

test('server lifecycle writes preserve current and legacy participant reads without granting unrelated access', async () => {
  await rulesEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'consultations/current'), {
      createdBy: 'doctor-1', patientUserId: 'patient-1', status: 'active',
    });
    await updateDoc(doc(db, 'consultations/current'), { status: 'completed' });
    await setDoc(doc(db, 'consultations/legacy'), {
      metadata: {
        createdBy: 'doctor-1', patientUserId: 'patient-1', doctorUserId: 'doctor-1',
        visibleToUsers: ['legacy-observer'],
      },
    });
    for (const [id, metadata] of [
      ['legacy-creator', { createdBy: 'doctor-1' }],
      ['legacy-doctor', { doctorUserId: 'doctor-1' }],
      ['legacy-patient', { patientUserId: 'patient-1' }],
      ['legacy-visible', { visibleToUsers: ['legacy-observer'] }],
    ]) {
      await setDoc(doc(db, 'consultations', id), { metadata });
    }
    await setDoc(doc(db, 'consultations/creator-only'), { createdBy: 'doctor-1' });
    await setDoc(doc(db, 'consultations/null-metadata'), {
      createdBy: 'doctor-1', patientUserId: 'patient-1', metadata: null,
    });
    await setDoc(doc(db, 'consultations/deleted-by-server'), { createdBy: 'doctor-1' });
    await deleteDoc(doc(db, 'consultations/deleted-by-server'));
  });
  const doctorDb = rulesEnvironment.authenticatedContext('doctor-1', { role: 'doctor' }).firestore();
  const patientDb = rulesEnvironment.authenticatedContext('patient-1', { role: 'patient' }).firestore();
  for (const db of [doctorDb, patientDb]) {
    for (const id of ['current', 'legacy', 'null-metadata']) {
      await assertSucceeds(getDoc(doc(db, 'consultations', id)));
    }
  }
  await assertSucceeds(getDoc(doc(doctorDb, 'consultations/creator-only')));
  await assertSucceeds(getDoc(doc(doctorDb, 'consultations/legacy-creator')));
  await assertSucceeds(getDoc(doc(doctorDb, 'consultations/legacy-doctor')));
  await assertSucceeds(getDoc(doc(patientDb, 'consultations/legacy-patient')));
  const visibleDb = rulesEnvironment.authenticatedContext('legacy-observer').firestore();
  await assertSucceeds(getDoc(doc(visibleDb, 'consultations/legacy')));
  await assertSucceeds(getDoc(doc(visibleDb, 'consultations/legacy-visible')));
  const ownRows = await assertSucceeds(getDocs(query(
    collection(doctorDb, 'consultations'), where('createdBy', '==', 'doctor-1')
  )));
  assert.equal(ownRows.size, 3);
  for (const context of [
    rulesEnvironment.authenticatedContext('doctor-2', { role: 'doctor' }),
    rulesEnvironment.authenticatedContext('patient-2', { role: 'patient' }),
    rulesEnvironment.authenticatedContext('reviewer-1', { role: 'faculty_reviewer' }),
    rulesEnvironment.unauthenticatedContext(),
  ]) {
    const db = context.firestore();
    for (const id of ['current', 'legacy', 'creator-only', 'null-metadata', 'legacy-creator', 'legacy-doctor', 'legacy-patient', 'legacy-visible']) {
      await assertFails(getDoc(doc(db, 'consultations', id)));
    }
    await assertFails(getDocs(collection(db, 'consultations')));
  }
});

test('only clinicians can claim room and call names from the browser', async () => {
  await rulesEnvironment.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'users/patient-1'), { email: 'patient@example.test', role: 'patient' });
    await setDoc(doc(adminDb, 'users/doctor-1'), { email: 'doctor@example.test', role: 'doctor' });
  });
  const roomFor = (uid) => ({ roomName: 'dr-room-0930', createdBy: uid, createdAt: new Date(), status: 'active' });
  const patientDb = rulesEnvironment.authenticatedContext('patient-1', { email: 'patient@example.test' }).firestore();
  const strangerDb = rulesEnvironment.authenticatedContext('stranger-1', { email: 'x@example.test' }).firestore();
  const doctorDb = rulesEnvironment.authenticatedContext('doctor-1', { email: 'doctor@example.test' }).firestore();

  // A patient or profile-less account must not squat a room name the server
  // later treats as proof of doctor ownership.
  await assertFails(setDoc(doc(patientDb, 'rooms/dr-room-0930'), roomFor('patient-1')));
  await assertFails(setDoc(doc(strangerDb, 'rooms/dr-room-0930'), roomFor('stranger-1')));
  await assertFails(setDoc(doc(patientDb, 'calls/dr-room-0930'), roomFor('patient-1')));
  // The doctor's own browser room/call records keep working.
  await assertSucceeds(setDoc(doc(doctorDb, 'rooms/dr-room-0930'), roomFor('doctor-1')));
  await assertSucceeds(setDoc(doc(doctorDb, 'calls/dr-room-0930'), roomFor('doctor-1')));
  await assertSucceeds(setDoc(doc(doctorDb, 'rooms/dr-room-0930'), { status: 'completed' }, { merge: true }));
});

test('the current room owner can take over a call buffer left by an earlier holder only by clearing it', async () => {
  await rulesEnvironment.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'users/doctor-1'), { email: 'doctor1@example.test', role: 'doctor' });
    await setDoc(doc(adminDb, 'users/doctor-2'), { email: 'doctor2@example.test', role: 'doctor' });
    await setDoc(doc(adminDb, 'users/patient-1'), { email: 'patient@example.test', role: 'patient' });
    // The room name now belongs to doctor-2; the call buffer is left over from doctor-1.
    await setDoc(doc(adminDb, 'rooms/shared-name'), {
      roomName: 'shared-name', createdBy: 'doctor-2', createdAt: new Date(), status: 'active',
      metadata: { createdBy: 'doctor-2' },
    });
    await setDoc(doc(adminDb, 'calls/shared-name'), {
      roomName: 'shared-name', createdBy: 'doctor-1', createdAt: new Date(), status: 'ended',
      metadata: { createdBy: 'doctor-1' },
      transcription: ['synthetic earlier line'], manualNotes: ['synthetic earlier note'],
    });
  });
  const previousDb = rulesEnvironment.authenticatedContext('doctor-1', { email: 'doctor1@example.test' }).firestore();
  const ownerDb = rulesEnvironment.authenticatedContext('doctor-2', { email: 'doctor2@example.test' }).firestore();
  const patientDb = rulesEnvironment.authenticatedContext('patient-1', { email: 'patient@example.test' }).firestore();
  const callRef = (db) => doc(db, 'calls/shared-name');
  const consentWrite = { transcriptionCapture: { active: true, consentConfirmed: true }, lastUpdated: new Date() };
  const takeover = (uid) => ({
    roomName: 'shared-name', createdBy: uid, metadata: { createdBy: uid }, createdAt: new Date(),
    status: 'active', consultationSessionId: null, transcription: [], manualNotes: [], lastUpdated: new Date(),
  });

  // Before takeover the room owner can neither read the earlier text nor write consent state.
  await assertFails(getDoc(callRef(ownerDb)));
  await assertFails(setDoc(callRef(ownerDb), consentWrite, { merge: true }));
  // A takeover that keeps the earlier lines, or leaves the earlier metadata owner, is denied.
  await assertFails(setDoc(callRef(ownerDb), { ...takeover('doctor-2'), transcription: ['synthetic earlier line'] }, { merge: true }));
  await assertFails(setDoc(callRef(ownerDb), { createdBy: 'doctor-2', transcription: [], manualNotes: [] }, { merge: true }));
  // Someone who does not own the room cannot take it over at all.
  await assertFails(setDoc(callRef(patientDb), takeover('patient-1'), { merge: true }));

  // The real join write claims the buffer and clears it; consent and notes then work.
  await assertSucceeds(setDoc(callRef(ownerDb), takeover('doctor-2'), { merge: true }));
  await assertSucceeds(setDoc(callRef(ownerDb), consentWrite, { merge: true }));
  const afterTakeover = await assertSucceeds(getDoc(callRef(ownerDb)));
  assert.deepEqual(afterTakeover.data().transcription, []);
  assert.deepEqual(afterTakeover.data().manualNotes, []);

  // The earlier holder loses access to the new consultation's buffer.
  await assertFails(getDoc(callRef(previousDb)));
  await assertFails(setDoc(callRef(previousDb), consentWrite, { merge: true }));
});

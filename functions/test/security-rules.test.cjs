/* eslint-disable @typescript-eslint/no-require-imports */
const { after, before, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc } = require('firebase/firestore');
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

test('doctor note attachments are owner-only and type bounded', async () => {
  const doctorStorage = rulesEnvironment.authenticatedContext('doctor-1', {
    role: 'doctor',
  }).storage();
  const otherStorage = rulesEnvironment.authenticatedContext('doctor-2', {
    role: 'doctor',
  }).storage();
  const path = 'notes/doctor-1/room-1/note.png';

  await assertSucceeds(uploadBytes(
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

  assert.ok(true);
});

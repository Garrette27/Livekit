import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { DisconnectReason } from 'livekit-client';
import jwt from 'jsonwebtoken';
import { spawnSync } from 'node:child_process';

test('Firebase Auth starts without experimental CommonJS-to-ESM loading', () => {
  const result = spawnSync(process.execPath, ['--no-experimental-require-module', '-e', 'require("firebase-admin/auth")'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

/** Execute real TypeScript modules with isolated IO adapters and synthetic data. */
function loadModule(path, dependencies = {}, globals = {}) {
  const moduleRecord = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    module: moduleRecord, exports: moduleRecord.exports, Date, Headers, FormData, Blob, AbortSignal,
    console: { log() {}, warn() {}, error() {} },
    require(name) {
      // Pure, IO-free classifier: tests exercise the real implementation.
      if (!(name in dependencies) && name.endsWith('database-availability')) {
        return loadModule('lib/services/shared/database-availability.ts');
      }
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
    ...globals,
  }, { filename: path });
  return moduleRecord.exports;
}

test('duplicate-identity replacement detaches the old page without closing the continuing visit', () => {
  const path = 'app/invite/[token]/page.tsx';
  const sourceText = readFileSync(path, 'utf8');
  const source = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'handleRoomDisconnect') {
      callback = node.initializer.arguments[0].getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(callback, 'Exercise the actual invitation-page disconnect callback');
  const exports = {};
  const processed = { current: false };
  const validation = { current: { synthetic: true } };
  const tracked = { current: 'synthetic-join' };
  let leaves = 0;
  let redirects = 0;
  let notices = 0;
  runInNewContext(ts.transpileModule(`export const disconnect = ${callback};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, DisconnectReason, hasProcessedExitRef: processed,
    validationResultRef: validation, trackedJoinKeyRef: tracked,
    handleConsultationExit() { leaves++; }, showToast() { notices++; },
    getPostCallRedirectPath: () => '/patient/dashboard',
    router: { replace(path) { assert.equal(path, '/patient/dashboard'); redirects++; } },
  });
  exports.disconnect(DisconnectReason.DUPLICATE_IDENTITY);
  assert.equal(leaves, 0);
  assert.equal(processed.current, true, 'Existing cleanup guard suppresses unload finalization');
  assert.equal(validation.current, null);
  assert.equal(tracked.current, null);
  assert.equal(redirects, 1);
  assert.equal(notices, 1);
  exports.disconnect(DisconnectReason.CLIENT_INITIATED);
  assert.equal(leaves, 1, 'Ordinary disconnect still follows the normal exit path');
  // Only the visible consultation room mounts media; the waiting page has none.
  assert.equal(sourceText.match(/onDisconnected=\{handleRoomDisconnect\}/g)?.length, 1);

  // The legacy room route must honor the same transport-vs-visit distinction.
  const legacyPath = 'app/room/[room]/patient/page.tsx';
  const legacyText = readFileSync(legacyPath, 'utf8');
  const legacySource = ts.createSourceFile(legacyPath, legacyText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let legacyCallback;
  function findLegacy(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(legacySource) === 'handleRoomDisconnect') {
      legacyCallback = node.initializer.arguments[0].getText(legacySource);
    }
    ts.forEachChild(node, findLegacy);
  }
  findLegacy(legacySource);
  assert.ok(legacyCallback);
  const legacyExports = {};
  const isLeavingRef = { current: false };
  runInNewContext(ts.transpileModule(`export const disconnect = ${legacyCallback};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports: legacyExports, DisconnectReason, isLeavingRef,
    leaveConsultation() { leaves++; }, showToast() { notices++; },
    getPostCallRedirectPath: () => '/patient/dashboard', router: { replace() { redirects++; } },
  });
  legacyExports.disconnect(DisconnectReason.DUPLICATE_IDENTITY);
  assert.equal(leaves, 1);
  assert.equal(isLeavingRef.current, true);
  assert.match(legacyText, /!token \|\| isLeavingRef.current/);
});

/** Transaction fake rejects collection-wide queries; admission must name one reserved visit. */
function admissionHarness(invitationPatch = {}, rowPatch = {}) {
  const documents = {
    'invitations/invite-a': { status: 'active', waitingRoomEnabled: true, roomName: 'room-a', createdBy: 'doctor-a', expiresAt: new Date(Date.now() + 3600000), ...invitationPatch },
    'waitingPatients/visit-a': { invitationId: 'invite-a', roomName: 'room-a', doctorUserId: 'doctor-a', joinedAt: new Date(), status: 'admitted', ...rowPatch },
  };
  let tokens = 0;
  let writes = 0;
  const issued = [];
  const db = {
    collection: name => ({ doc: id => ({ key: `${name}/${id}`, id }) }),
    async runTransaction(callback) {
      return callback({
        async get(ref) { return { id: ref.id, exists: !!documents[ref.key], data: () => documents[ref.key] }; },
        set(ref, patch) { writes++; documents[ref.key] = { ...documents[ref.key], ...patch }; },
      });
    },
  };
  const { FirestoreInvitationAccessCore } = loadModule('lib/services/invitation-access/invitation-access-core.ts', {
    '@/lib/invitations/validate-service': {}, '@/lib/consultations/identity-utils': {}, '@/lib/services/video-chat': {},
  });
  const service = new FirestoreInvitationAccessCore(db, { issueRoomToken(input) {
    tokens++;
    issued.push(input);
    assert.equal(input.roomName, 'room-a');
    assert.equal(input.subject, 'patient_invite-a_visit-a');
    return 'synthetic-consultation-token';
  } }, {});
  service.appendSessionModerationEvent = async () => {};
  return { service, documents, issued, counts: () => ({ tokens, writes }) };
}

const pollingInput = { invitationId: 'invite-a', waitingPatientId: 'visit-a', credentialRoomName: 'room-a-waiting' };
const admittingInput = { waitingPatientId: 'visit-a', roomName: 'room-a', doctorUserId: 'doctor-a' };

test('admission renewal rechecks persisted expiry, revocation, room and ownership', async () => {
  for (const [invitation, row] of [
    [{ status: 'revoked' }, {}], [{ expiresAt: new Date(Date.now() - 1) }, {}],
    [{ roomName: 'room-b' }, {}], [{ createdBy: 'doctor-b' }, {}],
    [{ waitingRoomEnabled: false }, {}], [{ expiresAt: null }, {}],
    [{}, { invitationId: 'missing' }], [{}, { joinedAt: null }],
  ]) {
    const h = admissionHarness(invitation, row);
    await assert.rejects(h.service.checkAdmission(pollingInput));
    await assert.rejects(h.service.admitWaitingEntry(admittingInput));
    assert.deepEqual(h.counts(), { tokens: 0, writes: 0 });
  }
});

test('only the exact current visit can renew, and valid waiting/admission still works', async () => {
  const h = admissionHarness();
  for (const input of [
    { ...pollingInput, waitingPatientId: undefined, patientEmail: 'other@example.test' },
    { ...pollingInput, invitationId: 'invite-b' },
    { ...pollingInput, credentialRoomName: 'room-b-waiting' },
  ]) await assert.rejects(h.service.checkAdmission(input));
  assert.equal(h.counts().tokens, 0);
  assert.equal((await h.service.checkAdmission(pollingInput)).admitted, true);
  for (const status of ['waiting', 'left', 'rejected']) {
    h.documents['waitingPatients/visit-a'].status = status;
    assert.equal((await h.service.checkAdmission(pollingInput)).admitted, false);
  }
  h.documents['waitingPatients/visit-a'].status = 'waiting';
  await assert.rejects(h.service.admitWaitingEntry({ ...admittingInput, doctorUserId: 'doctor-b' }));
  assert.equal((await h.service.admitWaitingEntry(admittingInput)).roomName, 'room-a');
  assert.equal(h.documents['waitingPatients/visit-a'].status, 'admitted');
  assert.equal((await h.service.admitWaitingEntry(admittingInput)).roomName, 'room-a');
  assert.deepEqual(h.counts(), { tokens: 3, writes: 1 });
});

function tokenModule() {
  return loadModule('lib/invitations/token-utils.ts', { jsonwebtoken: { default: jwt } }, {
    process: { env: { LIVEKIT_API_SECRET: 'synthetic-local-test-secret', LIVEKIT_API_KEY: 'synthetic-issuer' } },
  });
}

test('room credentials preserve an issuer-bound Firebase patient UID separately from the media identity', () => {
  const tokens = tokenModule();
  const token = tokens.signLiveKitRoomToken({
    subject: 'patient_invite-a_visit-a', roomName: 'room-a', patientUserId: 'firebase-patient-1',
  });
  const participant = tokens.verifyLiveKitRoomToken(token);
  assert.equal(participant.identity, 'patient_invite-a_visit-a');
  assert.equal(participant.patientUserId, 'firebase-patient-1');
});

test('direct invitation issuance binds the authenticated UID rather than the declared email', async () => {
  const tokens = tokenModule();
  const { validateInvitationAndIssueToken } = loadModule('lib/invitations/validate-service.ts', {
    '../firebase-admin': { getFirebaseAdmin: () => ({ collection: () => ({ doc: () => ({
      get: async () => ({ exists: true, data: () => ({
        roomName: 'room-a', createdBy: 'doctor-1', status: 'active',
        expiresAt: new Date(Date.now() + 3600000), waitingRoomEnabled: false,
      }) }),
    }) }) }) },
    './token-utils': tokens,
    './utils': { toDate: value => value },
    './waiting-patient-identity': loadModule('lib/invitations/waiting-patient-identity.ts'),
    '../events/event-schema': loadModule('lib/events/event-schema.ts'),
    './email-allowlist': { hasInvitationEmailAllowlist: () => false },
    './admission-policy': {},
    '../services/consultation-finalization': {},
    '../repositories/user-repository': { UserRepository: class {
      async getById() { return { exists: true, data: () => ({ role: 'patient' }) }; }
    } },
    '../consent/telehealth-consent': { hasTelehealthConsent: () => true },
    'firebase-admin/firestore': {},
    '../security/security-signal': { hashSecuritySignal: () => 'synthetic-hash' },
    './waiting-patient-key': {},
    './invitation-use-reservation': { reserveInvitationUse: async () => true },
  });
  const result = await validateInvitationAndIssueToken({
    token: tokens.signInvitationToken({ invitationId: 'invite-a', roomName: 'room-a' }),
    userEmail: 'patient2@example.test', clientIP: 'synthetic-signal', userAgent: 'synthetic-agent',
    authenticatedVisitor: { userId: 'patient-1', authenticatedEmail: 'patient1@example.test', isAnonymousAccount: false },
  });
  assert.equal(result.status, 200);
  assert.equal(tokens.verifyLiveKitRoomToken(result.body.liveKitToken).patientUserId, 'patient-1');
  const ownerResult = await validateInvitationAndIssueToken({
    token: tokens.signInvitationToken({ invitationId: 'invite-a', roomName: 'room-a' }),
    clientIP: 'synthetic-signal', userAgent: 'synthetic-agent',
    authenticatedVisitor: { userId: 'doctor-1', authenticatedEmail: 'doctor@example.test', isAnonymousAccount: false },
  });
  assert.equal(ownerResult.status, 403, 'The owning doctor cannot consume a patient visit');
});

test('invitation creation excludes the owning clinician from the patient direct-entry audience', async () => {
  let persisted;
  const response = { json: (body, init = {}) => ({ body, status: init.status || 200 }) };
  const { POST } = loadModule('app/api/invite/create/route.ts', {
    '@/lib/services/shared/request-logging': { withRequestLogging: (fn) => fn },
    'node:crypto': { randomUUID: () => 'synthetic-invitation' },
    'next/server': { NextResponse: response },
    '../../../../lib/firebase-admin': { getFirebaseAdmin: () => ({}) },
    '@/lib/services/shared/request-auth': { authorizeBearerRequest: async () => ({ ok: true, data: { userId: 'doctor-1', email: 'doctor@example.test' } }) },
    '@/lib/services/shared/http': {},
    '@/lib/services/room-access': { DoctorRoomAccess: class { async claimInvitationRoom() { return { ok: true }; } } },
    '../../../../lib/repositories/invitation-repository': { InvitationRepository: class { async create(_id, value) { persisted = value; } } },
    '../../../../lib/rate-limit': { enforceRateLimit: async () => null, RateLimitConfigs: { TOKEN_GENERATION: {} } },
    '../../../../lib/validation': { validateEmail: () => true, validateRoomName: () => true, sanitizeInput: (v) => v },
    '../../../../lib/invitations/token-utils': { signInvitationToken: () => 'synthetic-token' },
    '../../../../lib/invitations/utils': { buildInviteUrl: () => 'https://example.test/invite/synthetic-token' },
    '../../../../lib/security/security-signal': { hashSecuritySignal: (_kind, value) => `hash:${value}` },
    '../../../../lib/events/event-schema': { EVENT_DOMAINS: { INVITATION_AUDIT: 'invitation' } },
    '@/lib/invitations/invitation-use-reservation': { REUSABLE_INVITATION_MAX_USES: 999999 },
  });
  const result = await POST({ json: async () => ({ roomName: 'room-a', emailAllowlist: [' Doctor@Example.Test ', 'patient@example.test'] }) });
  assert.equal(result.status, 200);
  assert.equal(persisted.metadata.constraints.allowlistCount, 1);
  assert.deepEqual(Array.from(persisted.metadata.constraints.emailHashes), ['hash:patient@example.test']);
});

test('admission binds history to the registered patient and never to a guest’s declared email', async () => {
  const registered = admissionHarness({}, {
    patientId: 'firebase-patient-1', metadata: { isAnonymous: false, identitySource: 'registered-profile' },
  });
  await registered.service.checkAdmission(pollingInput);
  assert.equal(registered.issued[0].patientUserId, 'firebase-patient-1');
  const guest = admissionHarness({}, {
    patientId: 'anonymous_1', patientEmail: 'patient1@example.test',
    metadata: { isAnonymous: true, identitySource: 'self-declared' },
  });
  await guest.service.checkAdmission(pollingInput);
  assert.equal(guest.issued[0].patientUserId, undefined);
});

test('tracking uses the signed Firebase UID so a new admitted visit remains in patient history', async () => {
  const tokens = tokenModule();
  const accessToken = tokens.signLiveKitRoomToken({
    subject: 'patient_invite-a_visit-a', roomName: 'room-a', patientUserId: 'patient-1',
  });
  let tracked;
  const route = loadModule('app/api/track-consultation/route.ts', {
    '@/lib/services/shared/request-logging': { withRequestLogging: fn => fn },
    '@/lib/firebase-admin': { getFirebaseAdmin: () => ({}) },
    '@/lib/services/shared/http': { serviceResultToResponse: result => result },
    '@/lib/services/shared/service-result': loadModule('lib/services/shared/service-result.ts'),
    '@/lib/services/consultation-tracking': { FirestoreConsultationTrackingCore: class {
      async trackConsultation(input) { tracked = input; return { ok: true, data: {} }; }
    } },
    '@/lib/invitations/token-utils': tokens,
  });
  await route.POST({ text: async () => JSON.stringify({
    accessToken, roomName: 'room-a', action: 'join', userId: 'patient-2',
  }) });
  assert.equal(tracked.userId, 'patient-1');
  const service = patientHistoryFixture();
  const history = await service.buildPatientHistory({ patientUserId: tracked.userId });
  assert.ok(history.some(record => record.id === 'own-session'));
});

/** Exercise the tracking service with persisted encounter ownership and isolated writes. */
function trackingOwnershipFixture(patientUserId = 'patient-2', changeBeforeCommit = false) {
  let writes = 0;
  let closes = 0;
  const existing = {
    roomName: 'room-a', consultationSessionId: 'current-session', patientUserId,
    sessionStartedAt: new Date(), status: 'active', metadata: { patientUserId },
  };
  const { FirestoreConsultationTrackingCore } = loadModule('lib/services/consultation-tracking/consultation-tracking-core.ts', {
    '@/lib/consultations/identity-utils': loadModule('lib/consultations/identity-utils.ts'),
    '@/lib/consultations/session-timing': { calculateDurationMinutes: () => 0 },
    '@/lib/consultations/consultation-session-store': { resolveLeaveSessionId: () => 'current-session' },
    '@/lib/services/video-chat': { FirestoreConsultationSessionCore: class { async closeSession() { closes++; } } },
    '@/lib/services/consultation-finalization': { finalizeConsultationForRoom: async () => {} },
    '@/lib/repositories/room-repository': { RoomRepository: class {
      async getByRoom() { return { exists: true, data: () => ({ createdBy: 'doctor-1' }) }; }
    } },
    '@/lib/repositories/consultation-repository': { ConsultationRepository: class {
      async getByRoom() { return { exists: true, data: () => ({ ...existing, metadata: { ...existing.metadata } }) }; }
      async mergeFields(_room, patch) { writes++; Object.assign(existing, patch); }
    } },
    '@/lib/repositories/consultation-session-repository': { ConsultationSessionRepository: class {
      async getById() {
        if (changeBeforeCommit) {
          existing.patientUserId = 'patient-2';
          existing.metadata.patientUserId = 'patient-2';
          existing.consultationSessionId = 'later-session';
        }
        return { exists: true, data: () => ({ ...existing }) };
      }
    } },
    '@/lib/services/shared/service-result': loadModule('lib/services/shared/service-result.ts'),
  });
  const db = {
    collection: () => ({ doc: () => ({}) }),
    async runTransaction(callback) {
      return callback({
        async get() { return { exists: true, data: () => ({ ...existing, metadata: { ...existing.metadata } }) }; },
        set(_ref, patch) { writes++; Object.assign(existing, patch); },
      });
    },
  };
  return { service: new FirestoreConsultationTrackingCore(db), existing, counts: () => ({ writes, closes }) };
}

test('late leave events cannot overwrite another patient or a later encounter in the same room', async () => {
  for (const [owner, sessionId] of [['patient-2', 'current-session'], ['patient-1', 'earlier-session']]) {
    const fixture = trackingOwnershipFixture(owner);
    const result = await fixture.service.trackConsultation({
      roomName: 'room-a', action: 'leave', patientName: 'Synthetic visitor',
      userId: 'patient-1', consultationSessionId: sessionId,
    });
    assert.equal(result.ok, false);
    assert.deepEqual(fixture.counts(), { writes: 0, closes: 0 });
    assert.equal(fixture.existing.patientUserId, owner);
  }
});

test('the current patient can still close their own tracked encounter', async () => {
  const fixture = trackingOwnershipFixture('patient-1');
  const result = await fixture.service.trackConsultation({
    roomName: 'room-a', action: 'leave', patientName: 'Synthetic visitor',
    userId: 'patient-1', consultationSessionId: 'current-session',
  });
  assert.equal(result.ok, true);
  assert.deepEqual(fixture.counts(), { writes: 1, closes: 1 });
  assert.equal(fixture.existing.patientUserId, 'patient-1');
});

test('a new encounter appearing before leave commit keeps its identity and lifecycle', async () => {
  const fixture = trackingOwnershipFixture('patient-1', true);
  await fixture.service.trackConsultation({
    roomName: 'room-a', action: 'leave', patientName: 'Synthetic visitor',
    userId: 'patient-1', consultationSessionId: 'current-session',
  });
  assert.deepEqual(fixture.counts(), { writes: 0, closes: 0 });
  assert.equal(fixture.existing.patientUserId, 'patient-2');
  assert.equal(fixture.existing.consultationSessionId, 'later-session');
});

test('leave finalization targets the requested encounter instead of a later visit sharing its room', async () => {
  const sessions = {
    earlier: { roomName: 'room-a', status: 'completed', createdAt: new Date('2026-01-01') },
    later: { roomName: 'room-a', status: 'completed', createdAt: new Date('2026-01-02') },
  };
  const snapshot = id => ({ id, exists: true, data: () => sessions[id] });
  const finalization = loadModule('lib/services/consultation-finalization/consultation-finalization-core.ts', {
    '@/lib/consultations/session-timing': {},
    '@/lib/consultations/identity-utils': loadModule('lib/consultations/identity-utils.ts'),
    '@/lib/consultations/waiting-room-history': {},
    '@/lib/services/shared/service-result': loadModule('lib/services/shared/service-result.ts'),
    '@/lib/repositories/call-summary-repository': { CallSummaryRepository: class {
      async getById() { return { exists: true, data: () => ({ duration: 1, metadata: { isEdited: true } }) }; }
    } },
    '@/lib/repositories/consultation-repository': { ConsultationRepository: class {} },
    '@/lib/repositories/consultation-session-repository': { ConsultationSessionRepository: class {
      async findByRoom() { return ['earlier', 'later'].map(snapshot); }
      async getById(id) { return snapshot(id); }
    } },
    '@/lib/repositories/room-doctor-presence-repository': {},
    './summary-generator': {},
  });
  const result = await finalization.finalizeConsultationForRoom({}, {
    roomName: 'room-a', consultationSessionId: 'earlier', finalizedAt: new Date(), reason: 'patient_left',
  });
  assert.equal(result.consultationSessionId, 'earlier');
});

test('finalizing an earlier session preserves a later room encounter and keeps patient labels separate', async () => {
  const earlier = {
    roomName: 'room-a', status: 'completed', patientUserId: 'patient-1', doctorUserId: 'doctor-1',
    createdAt: new Date('2026-01-01'), metadata: { patientName: 'Synthetic earlier' },
  };
  const room = {
    consultationSessionId: 'later', status: 'active', patientUserId: 'patient-2',
    patientName: 'Synthetic later', metadata: { patientUserId: 'patient-2' },
  };
  let generated;
  let roomWrites = 0;
  const snapshot = value => ({ exists: true, data: () => ({ ...value }) });
  const db = {
    collection: () => ({ doc: () => ({}) }),
    async runTransaction(callback) {
      return callback({
        async get() { return snapshot(room); },
        set(_ref, patch) { roomWrites++; Object.assign(room, patch); },
      });
    },
  };
  const finalization = loadModule('lib/services/consultation-finalization/consultation-finalization-core.ts', {
    '@/lib/consultations/session-timing': { calculateDurationMinutes: () => 1 },
    '@/lib/consultations/identity-utils': loadModule('lib/consultations/identity-utils.ts'),
    '@/lib/consultations/waiting-room-history': { buildWaitingRoomHistorySnapshot: async () => ({
      totalParticipants: 0, participants: [], participantEmails: [],
      registeredParticipantCount: 0, anonymousParticipantCount: 0,
    }) },
    '@/lib/services/shared/service-result': loadModule('lib/services/shared/service-result.ts'),
    '@/lib/repositories/call-summary-repository': { CallSummaryRepository: class {
      async getById() { return { exists: false }; }
    } },
    '@/lib/repositories/consultation-repository': { ConsultationRepository: class {
      async getByRoom() { return snapshot(room); }
      async mergeFields(_id, patch) { roomWrites++; Object.assign(room, patch); }
    } },
    '@/lib/repositories/consultation-session-repository': { ConsultationSessionRepository: class {
      async getById() { return { id: 'earlier', ...snapshot(earlier) }; }
      async mergeFields(_id, patch) { Object.assign(earlier, patch); }
    } },
    '@/lib/repositories/room-doctor-presence-repository': {},
    './summary-generator': { generateAndStoreConsultationSummary: async input => { generated = input; } },
  });
  await finalization.finalizeConsultationForRoom(db, {
    roomName: 'room-a', consultationSessionId: 'earlier', finalizedAt: new Date(), reason: 'patient_left',
  });
  assert.equal(roomWrites, 0);
  assert.equal(room.consultationSessionId, 'later');
  assert.equal(room.patientUserId, 'patient-2');
  assert.equal(room.status, 'active');
  assert.equal(generated.patientName, 'Synthetic earlier');
  assert.equal(generated.consultationSessionId, 'earlier');

  room.consultationSessionId = 'earlier';
  room.patientUserId = 'patient-1';
  room.metadata.patientUserId = 'patient-1';
  await finalization.finalizeConsultationForRoom(db, {
    roomName: 'room-a', consultationSessionId: 'earlier', finalizedAt: new Date(), reason: 'patient_left',
  });
  assert.equal(roomWrites, 1);
  assert.equal(room.patientUserId, 'patient-1');
  assert.equal(room.status, 'completed');
});

test('waiting credentials cannot publish, subscribe or send data; consultation media remains enabled', () => {
  const tokens = tokenModule();
  for (const purpose of ['waiting', 'consultation']) {
    const token = tokens.signLiveKitRoomToken({ subject: 'patient_invite-a_visit-a', roomName: 'room-a-waiting', purpose });
    const payload = jwt.decode(token);
    assert.equal(payload.video.canPublish, purpose === 'consultation');
    assert.equal(payload.video.canSubscribe, purpose === 'consultation');
    assert.equal(payload.video.canPublishData, purpose === 'consultation');
    assert.equal(payload.audio.canPublish, purpose === 'consultation');
    assert.equal(tokens.verifyLiveKitRoomToken(token).identity, 'patient_invite-a_visit-a');
  }
  const source = readFileSync('lib/invitations/validate-service.ts', 'utf8');
  assert.equal(source.match(/purpose: 'waiting'/g)?.length, 1, 'First arrivals and reconnects share the single media-disabled waiting grant');
});

test('admission HTTP route rejects missing row/email lookup and another visit credential', async () => {
  const tokens = tokenModule();
  const { authorizeWaitingRoomRequest } = loadModule('lib/services/shared/waiting-room-auth.ts', {
    '@/lib/invitations/token-utils': tokens,
  });
  let calls = 0;
  const route = loadModule('app/api/waiting-room/check-admission/route.ts', {
    '@/lib/services/shared/request-logging': { withRequestLogging: fn => fn },
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '../../../../lib/firebase-admin': { getFirebaseAdmin: () => ({}) },
    '@/lib/services/shared/waiting-room-auth': { authorizeWaitingRoomRequest },
    '@/lib/services/invitation-access': {
      FirestoreInvitationAccessCore: class { async checkAdmission(input) { calls++; assert.equal(input.credentialRoomName, 'room-a-waiting'); return { success: true }; } },
      toInvitationAccessError: () => ({ status: 500 }),
    },
  });
  const accessToken = tokens.signLiveKitRoomToken({ subject: 'patient_invite-a_visit-a', roomName: 'room-a-waiting', purpose: 'waiting' });
  const request = body => ({ json: async () => body });
  assert.equal((await route.POST(request({ accessToken, invitationId: 'invite-a', patientEmail: 'other@example.test' }))).status, 400);
  assert.equal((await route.POST(request({ accessToken, invitationId: 'invite-a', waitingPatientId: 'visit-b' }))).status, 403);
  assert.equal(calls, 0);
  assert.equal((await route.POST(request({ accessToken, invitationId: 'invite-a', waitingPatientId: 'visit-a' }))).status, 200);
  assert.equal(calls, 1);
});

/** Extract a real effect so race tests exercise its cleanup and writes, not a duplicate implementation. */
function invitationEffect(marker, globals) {
  const path = 'app/invite/[token]/page.tsx';
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0].getText(source).includes(marker)) {
      callback = node.arguments[0].getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(callback);
  const exports = {};
  runInNewContext(ts.transpileModule(`export const effect = ${callback};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, AbortController, console: { error() {}, log() {} }, getBrowserSessionId: () => 'synthetic-tab-id', ...globals });
  return exports.effect();
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('failed signed-in token refresh never silently queues as a guest', async () => {
  let requests = 0;
  let failure;
  const cleanup = invitationEffect('const validateInvitation', {
    token: 'synthetic-invitation', authLoading: false,
    user: { reload: async () => { throw new Error('Synthetic refresh failure'); } },
    fetch: async () => { requests++; }, setIsValidating() {}, setError() {},
    setValidationFailureKind(value) { failure = value; },
  });
  await flush();
  assert.equal(requests, 0);
  assert.equal(failure, 'service');
  cleanup();
});

test('obsolete invitation validation cannot overwrite the newer account admission', async () => {
  let resolveOld;
  const results = [];
  const common = {
    token: 'synthetic-invitation', authLoading: false, user: null,
    setIsValidating() {}, setError() {}, setValidationFailureKind() {}, setRequiresConsent() {},
    setValidationResult: value => results.push(value),
  };
  const stopOld = invitationEffect('const validateInvitation', { ...common,
    fetch: () => new Promise(resolve => { resolveOld = resolve; }),
  });
  stopOld();
  const stopNew = invitationEffect('const validateInvitation', { ...common,
    fetch: async () => ({ status: 200, json: async () => ({ success: true, waitingRoomEnabled: false }) }),
  });
  await flush();
  resolveOld({ status: 200, json: async () => ({ success: true, waitingRoomEnabled: true }) });
  await flush();
  assert.equal(results.length, 1);
  assert.equal(results[0].waitingRoomEnabled, false);
  stopNew();
});

test('waiting admission polling never overlaps or commits after the visit changes', async () => {
  let tick;
  let resolveRequest;
  let requests = 0;
  let writes = 0;
  const stop = invitationEffect('const checkAdmission', {
    validationResult: { invitationId: 'invite-a', waitingPatientId: 'visit-a', waitingRoomEnabled: true, waitingRoomToken: true },
    waitingPatientIdRef: { current: 'visit-a' },
    fetch: () => { requests++; return new Promise(resolve => { resolveRequest = resolve; }); },
    setInterval: callback => { tick = callback; return 1; }, clearInterval() {},
    setError() {}, setValidationResult() { writes++; },
  });
  tick(); tick();
  assert.equal(requests, 1);
  stop();
  resolveRequest({ json: async () => ({ success: true, admitted: true, liveKitToken: 'synthetic' }) });
  await flush();
  assert.equal(writes, 0);
});

test('authenticated requests add the token without sending caller-asserted identity', async () => {
  let sent;
  const { authenticatedFetch } = loadModule('lib/auth/authenticated-fetch.ts', {
    '@/lib/firebase': { auth: { currentUser: { getIdToken: async () => 'synthetic-token' } } },
  }, { fetch: async (...args) => { sent = args; return { ok: true }; } });
  await authenticatedFetch('/api/link-patient-consultations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pendingSessionIds: ['synthetic-session'] }),
  });
  assert.equal(sent[1].headers.get('Authorization'), 'Bearer synthetic-token');
  assert.equal(sent[1].headers.get('Content-Type'), 'application/json');
  const dashboard = readFileSync('app/patient/dashboard/page.tsx', 'utf8');
  assert.match(dashboard, /authenticatedFetch\('\/api\/link-patient-consultations'/);
  assert.doesNotMatch(dashboard, /fetch\('\/api\/link-patient-consultations'/);
});

/** Run the actual legacy linking handler against synthetic persisted records. */
function consultationLinkingFixture() {
  const session = { doctorUserId: 'doctor-1', roomName: 'shared-room', patientUserId: 'patient-2' };
  const consultation = {
    createdBy: 'doctor-1', patientUserId: 'patient-2', consultationSessionId: 'later-session',
    metadata: { visibleToUsers: ['doctor-1', 'patient-2'] },
  };
  const summary = { createdBy: 'doctor-1', patientUserId: 'patient-2' };
  const snapshot = (id, value) => ({ id, exists: true, data: () => value });
  const repository = (value) => class {
    async getById(id) { return snapshot(id, value); }
    async getByRoom(id) { return snapshot(id, value); }
    async findByPatient() { return []; }
    async findByPatientEmail() { return []; }
    async mergeFields(_id, patch) { Object.assign(value, patch); }
  };
  const route = loadModule('app/api/link-patient-consultations/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/lib/firebase-admin': { getFirebaseAdmin: () => ({}) },
    '@/lib/repositories/call-summary-repository': { CallSummaryRepository: repository(summary) },
    '@/lib/repositories/consultation-repository': { ConsultationRepository: repository(consultation) },
    '@/lib/repositories/consultation-session-repository': { ConsultationSessionRepository: repository(session) },
    '@/lib/repositories/invitation-repository': { InvitationRepository: class {
      async findByEmailAllowed() { return [snapshot('allowlisted-invite', { roomName: 'shared-room' })]; }
      async findByEmailAllowedHash() { return []; }
    } },
    '@/lib/services/shared/request-auth': {
      authorizeBearerRequest: async () => ({ ok: true, data: { userId: 'patient-1', email: 'patient1@example.test', role: 'patient' } }),
    },
    '@/lib/services/shared/http': {},
    '@/lib/services/shared/request-logging': { withRequestLogging: fn => fn },
    '@/lib/security/security-signal': { hashSecuritySignal: () => 'synthetic-hash' },
  });
  return { route, session, consultation, summary };
}

test('browser-supplied pending session IDs cannot claim another patient or rewrite a later encounter', async () => {
  const fixture = consultationLinkingFixture();
  const response = await fixture.route.POST({ json: async () => ({ pendingSessionIds: ['earlier-session'] }) });
  assert.equal(response.status, 200);
  assert.equal(fixture.session.patientUserId, 'patient-2');
  assert.equal(fixture.consultation.patientUserId, 'patient-2');
  assert.equal(fixture.consultation.consultationSessionId, 'later-session');
  assert.equal(fixture.summary.patientUserId, 'patient-2');
  assert.equal(response.body.linkedCount, 0);
});

test('an invitation email match cannot grant visibility to another patient’s later consultation', async () => {
  const fixture = consultationLinkingFixture();
  const response = await fixture.route.POST({ json: async () => ({ pendingSessionIds: [] }) });
  assert.equal(response.status, 200);
  assert.deepEqual(fixture.consultation.metadata.visibleToUsers, ['doctor-1', 'patient-2']);
  assert.equal(response.body.linkedCount, 0);
});

test('obsolete linking payloads cannot cause a crash or change patient identity', async () => {
  const fixture = consultationLinkingFixture();
  const response = await fixture.route.POST({ json: async () => ({ pendingSessionIds: [17, null, {}] }) });
  assert.equal(response.status, 200);
  assert.equal(fixture.session.patientUserId, 'patient-2');
  assert.equal(response.body.linkedCount, 0);
});

/** Exercise the history projection and real repository query builders in memory. */
function patientHistoryFixture() {
  const own = { createdBy: 'doctor-1', patientUserId: 'patient-1', roomName: 'room-own' };
  const legacy = { createdBy: 'doctor-1', roomName: 'room-legacy', metadata: { patientUserId: 'patient-1' } };
  const wrongPatient = { ...own, patientUserId: 'patient-2', patientEmail: 'patient1@example.test' };
  const guest = { ...wrongPatient, patientUserId: 'anonymous' };
  const conflicting = { ...wrongPatient, metadata: { patientUserId: 'patient-1' } };
  const data = {
    'call-summaries': {
      'own-summary': {
        ...own, summary: 'synthetic draft marker', riskLevel: 'Unknown', keyPoints: ['synthetic marker'],
        waitingRoomHistory: { totalParticipants: 1, participants: [{ patientEmail: 'other@example.test' }] },
      },
      'legacy-summary': legacy,
      'other-summary': wrongPatient,
      'guest-summary': guest,
      'conflicting-summary': conflicting,
    },
    consultationSessions: {
      'own-session': { ...own, status: 'completed' },
      'legacy-session': { ...legacy, status: 'completed' },
      'other-session': { ...wrongPatient, status: 'completed' },
      'guest-session': { ...guest, status: 'completed' },
      'conflicting-session': { ...conflicting, status: 'completed' },
    },
  };
  const db = { collection(name) {
    const filters = [];
    return {
      where(field, _operator, value) { filters.push([field, value]); return this; },
      limit() { return this; },
      async get() {
        const docs = Object.entries(data[name] || {}).filter(([, value]) => filters.every(([field, expected]) =>
          field.split('.').reduce((current, key) => current?.[key], value) === expected
        )).map(([id, value]) => ({ id, data: () => value }));
        return { docs };
      },
    };
  } };
  const { FirestoreSummaryProjectionService } = loadModule('lib/services/history-summary/summary-projection-service.ts', {
    '@/lib/consultations/identity-utils': loadModule('lib/consultations/identity-utils.ts'),
    '@/lib/services/consultation-finalization': { generateAndStoreConsultationSummary() { throw new Error('Unexpected AI call'); } },
    '@/lib/repositories/call-summary-repository': loadModule('lib/repositories/call-summary-repository.ts'),
    '@/lib/repositories/consultation-session-repository': loadModule('lib/repositories/consultation-session-repository.ts'),
    '@/lib/repositories/user-repository': { UserRepository: class { async getEmail() { return undefined; } } },
  });
  return new FirestoreSummaryProjectionService(db);
}

test('patient history requires a consistent recorded UID; matching email alone never grants access', async () => {
  const service = patientHistoryFixture();
  const history = await service.buildPatientHistory({ patientUserId: 'patient-1', patientEmail: 'patient1@example.test' });
  assert.deepEqual([...history.map(record => record.id)].sort(), [
    'legacy-session', 'legacy-summary', 'own-session', 'own-summary',
  ]);
});

test('patient history excludes clinician AI drafts and other waiting participants', async () => {
  const service = patientHistoryFixture();
  const history = await service.buildPatientHistory({ patientUserId: 'patient-1' });
  const own = history.find(record => record.id === 'own-summary');
  assert.ok(own);
  for (const field of ['summary', 'riskLevel', 'keyPoints', 'category', 'recommendations', 'followUpActions', 'waitingRoomHistory', 'chatHistory']) {
    assert.equal(field in own, false, `Patient history must not expose ${field}`);
  }
});

test('login distinguishes a Firestore outage from a resolved role check', async () => {
  const serviceResult = loadModule('lib/services/shared/service-result.ts');
  const http = loadModule('lib/services/shared/http.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options.status }) } },
  });
  let lookupFailure;
  let lookupCount = 0;
  const route = loadModule('app/api/user/role-conflict/route.ts', {
    '@/lib/firebase-admin': { getFirebaseAdmin: () => ({}) },
    '@/lib/repositories/user-repository': { UserRepository: class {
      async findAllByEmail() {
        lookupCount++;
        if (lookupFailure) throw lookupFailure;
        return [];
      }
    } },
    '@/lib/services/shared/http': http,
    '@/lib/services/shared/request-auth': {
      authenticateBearerToken: async () => serviceResult.serviceOk({ email: 'doctor@example.test', userId: 'd1' }),
    },
    '@/lib/services/shared/request-logging': { withRequestLogging: fn => fn },
    '@/lib/services/shared/service-result': serviceResult,
  });
  const request = email => ({ json: async () => ({ email, expectedRole: 'doctor' }) });
  assert.equal((await route.POST(request('other@example.test'))).status, 403);
  assert.equal(lookupCount, 0);
  for (const code of [4, 8, 14]) {
    lookupFailure = { code, message: 'internal provider detail' };
    const response = await route.POST(request('doctor@example.test'));
    assert.equal(response.status, 503);
    assert.equal(response.body.code, 'role_check_unavailable');
    assert.doesNotMatch(JSON.stringify(response), /internal provider detail/);
  }
  lookupFailure = null;
  assert.equal((await route.POST(request('doctor@example.test'))).body.hasConflict, false);

  const client = loadModule('lib/auth/role-conflict.ts', {
    '@/lib/auth/authenticated-fetch': { authenticatedFetch: async () => ({
      status: 503, json: async () => { throw Error('The response may be HTML'); },
    }) },
  });
  await assert.rejects(
    client.checkRoleConflictByEmail({ email: 'doctor@example.test', expectedRole: 'doctor' }),
    client.RoleConflictUnavailableError,
  );
});

function queueHarness() {
  let snapshotCallback;
  let errorCallback;
  let listenerCount = 0;
  let unsubscribed = 0;
  const timers = new Map();
  const visibilityListeners = new Set();
  const document = {
    visibilityState: 'visible',
    addEventListener(_event, listener) { visibilityListeners.add(listener); },
    removeEventListener(_event, listener) { visibilityListeners.delete(listener); },
  };
  let queryConstraints;
  const coordinator = loadModule('lib/waiting-room/waiting-queue-coordinator.ts', {
    '@/lib/firebase': { db: {} },
    'firebase/firestore': {
      collection: () => ({}),
      where: (...constraint) => constraint,
      query(_collection, ...constraints) { queryConstraints = constraints; },
      onSnapshot(_query, onSnapshot, onError) {
        listenerCount++;
        snapshotCallback = onSnapshot;
        errorCallback = onError;
        return () => { unsubscribed++; };
      },
    },
  }, { document, window: {
    setInterval(fn) { const id = timers.size + 1; timers.set(id, fn); return id; },
    clearInterval(id) { timers.delete(id); },
  } });
  return {
    ...coordinator, timers, visibilityListeners,
    setVisibility(state) {
      document.visibilityState = state;
      visibilityListeners.forEach(listener => listener());
    },
    constraints: () => queryConstraints,
    emit() { snapshotCallback({ get docs() { throw new Error('Raw rows must not enter the UI'); } }); },
    fail() { errorCallback(new Error('Synthetic permission failure')); },
    counts() { return { listenerCount, unsubscribed }; },
  };
}

test('realtime invalidates without exposing snapshot rows, shares a listener, and cleans up', () => {
  const queue = queueHarness();
  let invalidations = 0;
  const input = { doctorUserId: 'synthetic-doctor', onInvalidate: (...args) => {
    assert.equal(args.length, 0);
    invalidations++;
  }, onUnavailable: () => {} };
  const first = queue.subscribeToDoctorQueueChanges(input);
  const second = queue.subscribeToDoctorQueueChanges(input);
  assert.equal(queue.counts().listenerCount, 1);
  assert.equal(JSON.stringify(queue.constraints()), JSON.stringify([
    ['doctorUserId', '==', 'synthetic-doctor'], ['status', 'in', ['waiting', 'admitted']],
  ]));
  queue.emit();
  assert.equal(invalidations, 2);
  first();
  assert.equal(queue.counts().unsubscribed, 0);
  second();
  assert.equal(queue.counts().unsubscribed, 1);
});

test('periodic refresh survives stream failure and shared requests stay deduplicated', async () => {
  const queue = queueHarness();
  let ticks = 0;
  let failures = 0;
  const stopStream = queue.subscribeToDoctorQueueChanges({
    doctorUserId: 'synthetic-doctor', onInvalidate() {}, onUnavailable() { failures++; },
  });
  const stopOne = queue.subscribeToWaitingQueuePoll('scope', 15000, () => { ticks++; });
  const stopTwo = queue.subscribeToWaitingQueuePoll('scope', 15000, () => { ticks++; });
  assert.equal(queue.timers.size, 1);
  queue.fail();
  assert.equal(failures, 1);
  for (const tick of queue.timers.values()) tick();
  assert.equal(ticks, 2);
  let resolveRequest;
  let requests = 0;
  const fetcher = () => { requests++; return new Promise(resolve => { resolveRequest = resolve; }); };
  const one = queue.fetchWaitingQueueOnce('scope', fetcher);
  const two = queue.fetchWaitingQueueOnce('scope', fetcher);
  assert.equal(one, two);
  resolveRequest([]);
  await Promise.all([one, two]);
  assert.equal(requests, 1);
  stopOne(); stopTwo(); stopStream();
  assert.equal(queue.timers.size, 0);
  const hook = readFileSync('hooks/useWaitingQueue.ts', 'utf8');
  assert.doesNotMatch(hook, /onPatients:|isStreaming|setIsStreaming/);
  assert.match(hook, /onInvalidate:[\s\S]*?void refresh\(false\)/);
  assert.match(hook, /!roomName \|\| waitingPatient.roomName === roomName/);
});

test('periodic queue refresh pauses in background and reconciles once on return', () => {
  const queue = queueHarness();
  let calls = 0;
  queue.setVisibility('hidden');
  const stopOne = queue.subscribeToWaitingQueuePoll('scope', 15000, () => { calls++; });
  const stopTwo = queue.subscribeToWaitingQueuePoll('scope', 15000, () => { calls++; });
  assert.equal(queue.timers.size, 0);
  assert.equal(queue.visibilityListeners.size, 1);
  queue.setVisibility('visible');
  assert.equal(calls, 2);
  assert.equal(queue.timers.size, 1);
  queue.setVisibility('hidden');
  assert.equal(queue.timers.size, 0);
  assert.equal(calls, 2);
  stopOne();
  stopTwo();
  assert.equal(queue.visibilityListeners.size, 0);
  queue.setVisibility('visible');
  assert.equal(calls, 2);
});

test('a repeated stale unsubscribe cannot detach a replacement poll group', () => {
  const queue = queueHarness();
  const stopOld = queue.subscribeToWaitingQueuePoll('same-scope', 15000, () => {});
  stopOld();
  const stopReplacement = queue.subscribeToWaitingQueuePoll('same-scope', 15000, () => {});
  stopOld();
  const stopPeer = queue.subscribeToWaitingQueuePoll('same-scope', 15000, () => {});
  assert.equal(queue.timers.size, 1, 'Stale cleanup must not cause a second same-scope timer');
  assert.equal(queue.visibilityListeners.size, 1);
  stopReplacement(); stopPeer();
  assert.equal(queue.timers.size, 0);
  assert.equal(queue.visibilityListeners.size, 0);
});

test('100 queue consumers share one in-flight request, recover after failure and isolate scopes', async () => {
  const queue = queueHarness();
  let calls = 0;
  let finish;
  const fetcher = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const requests = Array.from({ length: 100 }, () => queue.fetchWaitingQueueOnce('one-scope', fetcher));
  assert.equal(calls, 1);
  assert.ok(requests.every(request => request === requests[0]));
  finish([]);
  await Promise.all(requests);
  await assert.rejects(queue.fetchWaitingQueueOnce('one-scope', async () => { throw Error('synthetic outage'); }));
  assert.equal(await queue.fetchWaitingQueueOnce('one-scope', async () => 'recovered'), 'recovered');
  const first = queue.fetchWaitingQueueOnce('one-scope', fetcher);
  const finishFirst = finish;
  const other = queue.fetchWaitingQueueOnce('other-scope', fetcher);
  assert.notEqual(first, other);
  assert.equal(calls, 3);
  finishFirst([]); finish([]);
  await Promise.all([first, other]);
});

test('100 queue subscribers use one timer and leak no timers or listeners over visibility cycles', () => {
  const queue = queueHarness();
  let ticks = 0;
  const stops = Array.from({ length: 100 }, () => queue.subscribeToWaitingQueuePoll('one-scope', 15000, () => { ticks++; }));
  assert.equal(queue.timers.size, 1);
  assert.equal(queue.visibilityListeners.size, 1);
  for (let cycle = 0; cycle < 100; cycle++) {
    queue.setVisibility('hidden');
    assert.equal(queue.timers.size, 0);
    queue.setVisibility('visible');
    assert.equal(queue.timers.size, 1);
  }
  assert.equal(ticks, 10000);
  stops.forEach(stop => stop());
  assert.equal(queue.timers.size, 0);
  assert.equal(queue.visibilityListeners.size, 0);
});

test('database availability classification never converts permission errors into retryable outages', () => {
  const { isDatabaseUnavailableError } = loadModule('lib/services/shared/database-availability.ts');
  for (const code of [4, 8, 14, 'resource-exhausted', 'RESOURCE_EXHAUSTED', 'deadline-exceeded', 'unavailable']) {
    assert.equal(isDatabaseUnavailableError({ code }), true, String(code));
  }
  for (const error of [null, undefined, {}, { code: 7 }, { code: 'permission-denied' }, { code: 'unauthenticated' }, { message: 'quota exceeded' }]) {
    assert.equal(isDatabaseUnavailableError(error), false);
  }
});

/** Equality-query fake keeps filtering behavior in the actual domain service. */
function syntheticDatabase(collections) {
  function query(rows) {
    return {
      where(field, operator, value) {
        assert.equal(operator, '==');
        return query(rows.filter(row => row[field] === value));
      },
      limit(count) { return query(rows.slice(0, count)); },
      async get() { return { docs: rows.map(row => ({ id: row.id, data: () => row })) }; },
    };
  }
  return {
    invitationBatches: [],
    collection(name) {
      assert.equal(name === 'invitations' || name === 'waitingPatients', true);
      return name === 'invitations' ? { doc: id => id } : query(collections[name] || []);
    },
    async getAll(...ids) {
      this.invitationBatches.push(ids);
      return ids.map(id => {
        const invitation = collections.invitations.find(row => row.id === id);
        return { id, exists: !!invitation, data: () => invitation };
      });
    },
  };
}

test('canonical queue excludes stale, expired, revoked, other-room and other-doctor rows', async () => {
  const now = Date.now();
  const hour = 3600000;
  const active = { id: 'active', roomName: 'room-a', createdBy: 'd1', status: 'active', waitingRoomEnabled: true, expiresAt: new Date(now + hour) };
  const row = { doctorUserId: 'd1', roomName: 'room-a', invitationId: 'active', status: 'admitted', joinedAt: new Date(now - 10000) };
  const db = syntheticDatabase({
    invitations: [active, { ...active, id: 'expired', expiresAt: new Date(now - hour) },
      { ...active, id: 'revoked', status: 'revoked' },
      { ...active, id: 'other-room', roomName: 'room-b' },
      { ...active, id: 'other-doctor', createdBy: 'd2' }, { ...active, id: 'unused' }],
    waitingPatients: [{ ...row, id: 'current' },
      { ...row, id: 'legacy-status', status: undefined },
      { ...row, id: 'foreign-invitation', invitationId: 'other-doctor' },
      { ...row, id: 'wrong-room', invitationId: 'other-room' },
      { ...row, id: 'stale', joinedAt: new Date(now - 48 * hour) },
      { ...row, id: 'expired', invitationId: 'expired' },
      { ...row, id: 'revoked', invitationId: 'revoked' },
      { ...row, id: 'other-room', invitationId: 'other-room', roomName: 'room-b' },
      { ...row, id: 'other-doctor', invitationId: 'other-doctor', doctorUserId: 'd2' },
      { ...row, id: 'missing-date', joinedAt: null }, { ...row, id: 'left', status: 'left' }],
  });
  const { FirestoreInvitationAccessCore } = loadModule('lib/services/invitation-access/invitation-access-core.ts', {
    '@/lib/invitations/validate-service': {}, '@/lib/consultations/identity-utils': {},
    '@/lib/services/video-chat': {},
  });
  const service = new FirestoreInvitationAccessCore(db, {}, {});
  const rows = await service.listWaitingEntries({ doctorUserId: 'd1', roomName: 'room-a', statuses: ['waiting', 'admitted'], activeOnly: true });
  assert.deepEqual(Array.from(rows, item => item.id), ['current', 'legacy-status']);
  assert.deepEqual(db.invitationBatches, [['active', 'other-doctor', 'other-room', 'expired', 'revoked']]);
  const empty = await service.listWaitingEntries({ doctorUserId: 'empty', statuses: ['waiting', 'admitted'], activeOnly: true });
  assert.equal(empty.length, 0);
  assert.equal(db.invitationBatches.length, 1);
  const history = await service.listWaitingEntries({ doctorUserId: 'd1', roomName: 'room-a', statuses: ['admitted'], activeOnly: false });
  assert.ok(history.some(item => item.id === 'stale'), 'History is retained, not deleted');
});

test('transcription retries at most twice and carries only bounded provider status', async () => {
  let calls = 0;
  const transcriber = loadModule('lib/services/transcription/openai-audio-transcriber.ts', {}, {
    process: { env: {} }, fetch: async () => { calls++; return { status: 429, ok: false }; },
  });
  await assert.rejects(new transcriber.OpenAiAudioTranscriber('synthetic-key', 'synthetic-model').transcribe({
    audio: new Blob(['synthetic audio']), filename: 'test.webm',
  }), error => error instanceof transcriber.AudioTranscriptionProviderError && error.providerStatus === 429);
  assert.equal(calls, 2);
  calls = 0;
  const transportRetry = loadModule('lib/services/transcription/openai-audio-transcriber.ts', {}, {
    process: { env: {} }, fetch: async () => {
      calls++;
      if (calls === 1) throw new Error('Synthetic transport failure');
      return { status: 429, ok: false };
    },
  });
  await assert.rejects(new transportRetry.OpenAiAudioTranscriber('synthetic-key', 'synthetic-model').transcribe({
    audio: new Blob(['synthetic audio']), filename: 'test.webm',
  }));
  assert.equal(calls, 2, 'Transport retry must not be followed by a third status retry');
  const route = readFileSync('app/api/session-transcription/chunks/route.ts', 'utf8');
  assert.match(route, /providerStatus === 429/);
  assert.match(route, /transcription_capacity_limited/);
  const bridge = readFileSync('app/room/[room]/components/shared/SessionTranscriptionBridge.tsx', 'utf8');
  assert.match(bridge, /\[401, 403, 404, 503\]/);
  assert.match(bridge, /Transcription paused/);
});

/** Serialized-transaction fake: real Firestore makes one of two same-document writers retry. */
function reservationFixture({ waitingRows = 0, maxPatients = 10, maxUses = 999999 } = {}) {
  const { reserveWaitingVisit } = loadModule('lib/invitations/invitation-use-reservation.ts');
  const rows = new Map(Array.from({ length: waitingRows }, (_, i) => [`waitingPatients/old-${i}`, { status: 'waiting', roomName: 'room-a', invitationId: 'invite-a' }]));
  let invitation = { status: 'active', expiresAt: new Date(Date.now() + 3600000), maxPatients, currentUses: 0, maxUses };
  let serial = Promise.resolve();
  let next = 0;
  const query = (filters = []) => ({
    query: true, filters, where: (field, _op, value) => query([...filters, [field, value]]),
    orderBy() { return this; }, offset() { return this; }, limit() { return this; },
  });
  const ref = path => ({ path, collection: name => collection(`${path}/${name}`) });
  const collection = path => ({ ...query(), doc: id => ref(`${path}/${id || `auto-${next++}`}`) });
  const db = { collection, runTransaction(callback) {
    const run = serial.then(() => callback({
      async get(target) {
        if (target.query) {
          return { size: target.filters.length ? [...rows.values()].filter(row => target.filters.every(([f, v]) => row[f] === v)).length : 0, docs: [] };
        }
        if (target.path === 'invitations/invite-a') return { exists: true, data: () => invitation };
        return rows.has(target.path) ? { exists: true, data: () => rows.get(target.path) } : { exists: false };
      },
      update(target, value) { if (target.path === 'invitations/invite-a') invitation = { ...invitation, ...value }; },
      set(target, value) { if (/^waitingPatients\/[^/]+$/.test(target.path)) rows.set(target.path, { ...(rows.get(target.path) || {}), ...value }); },
      delete() {},
    }));
    serial = run.catch(() => {});
    return run;
  } };
  const arrive = (id, status = 'waiting', principalKeyed = true) => reserveWaitingVisit(db, 'invite-a', { synthetic: true }, {
    id, roomName: 'room-a', status, principalKeyed, newVisitId: `visit-${next++}`,
    onNewVisit: { invitationId: 'invite-a' }, onEachVisit: { roomName: 'room-a', invitationId: 'invite-a' },
  });
  return { arrive, rows, waiting: () => [...rows.values()].filter(row => row.status === 'waiting').length, invitation: () => invitation };
}

test('waiting target is enforced inside the reservation transaction under concurrent arrivals', async () => {
  const pair = reservationFixture({ waitingRows: 9 });
  const outcomes = await Promise.all([pair.arrive('new-a'), pair.arrive('new-b')]);
  assert.deepEqual(outcomes.map(o => o.outcome).sort(), ['full', 'reserved']);
  assert.equal(pair.waiting(), 10);
  assert.equal(pair.invitation().currentUses, 1, 'A refused arrival consumes no invitation use');
  const burst = reservationFixture({ maxPatients: 3 });
  await Promise.all(Array.from({ length: 10 }, (_, i) => burst.arrive(`burst-${i}`)));
  assert.equal(burst.waiting(), 3);
});

test('a full queue still admits a reconnect and verified direct entry, which add no waiting row', async () => {
  const full = reservationFixture({ waitingRows: 10 });
  assert.equal((await full.arrive('old-0')).outcome, 'reserved');
  assert.equal((await full.arrive('verified', 'admitted')).outcome, 'reserved');
  assert.equal(full.waiting(), 10);
  const source = readFileSync('lib/invitations/validate-service.ts', 'utf8');
  const precheck = source.slice(source.indexOf('function validateUsageLimits'), source.indexOf('async function findExistingWaitingPatient'));
  assert.doesNotMatch(precheck, /waitingPatients/, 'No capacity count outside the reservation transaction');
});

test('a returning visitor starts a new visit at the back of the queue; a reconnect keeps its visit', async () => {
  const h = reservationFixture();
  const first = await h.arrive('returning');
  const firstJoined = h.rows.get('waitingPatients/returning').joinedAt;
  const reconnect = await h.arrive('returning');
  assert.equal(reconnect.visitId, first.visitId);
  assert.equal(reconnect.startedNewVisit, false);
  Object.assign(h.rows.get('waitingPatients/returning'), { status: 'rejected', rejectedAt: new Date(0) });
  await new Promise(resolve => setTimeout(resolve, 2));
  const second = await h.arrive('returning');
  const row = h.rows.get('waitingPatients/returning');
  assert.notEqual(second.visitId, first.visitId);
  assert.equal(row.currentVisitId, second.visitId);
  assert.equal(row.rejectedAt, null, 'Previous end markers are cleared');
  assert.ok(row.joinedAt > firstJoined, 'Oldest-first order reflects this visit, not the earlier one');
});

test('room credentials carry the signed visit id', () => {
  const tokens = tokenModule();
  const token = tokens.signLiveKitRoomToken({ subject: 'patient_invite-a_visit-a', roomName: 'room-a-waiting', purpose: 'waiting', visitId: 'visit-1' });
  assert.equal(tokens.verifyLiveKitRoomToken(token).visitId, 'visit-1');
  assert.equal(tokens.verifyLiveKitRoomToken(tokens.signLiveKitRoomToken({ subject: 'patient_x_y', roomName: 'r' })).visitId, undefined);
});

test('an earlier-visit credential cannot poll admission or close the current visit', async () => {
  const h = admissionHarness({}, { currentVisitId: 'visit-2' });
  for (const credentialVisitId of [undefined, 'visit-1']) {
    await assert.rejects(h.service.checkAdmission({ ...pollingInput, credentialVisitId }), /earlier visit/);
  }
  assert.equal(h.counts().tokens, 0);
  const admitted = await h.service.checkAdmission({ ...pollingInput, credentialVisitId: 'visit-2' });
  assert.equal(admitted.admitted, true);
  assert.equal(h.issued[0].visitId, 'visit-2', 'Admission token stays bound to the same visit');

  const documents = { 'waitingPatients/visit-a': { invitationId: 'invite-a', roomName: 'room-a', status: 'waiting', joinedAt: new Date(), currentVisitId: 'visit-2' } };
  const doc = id => ({ async get() { return { id, exists: !!documents[`waitingPatients/${id}`], data: () => documents[`waitingPatients/${id}`] }; },
    async set(patch) { Object.assign(documents[`waitingPatients/${id}`], patch); } });
  const { FirestoreInvitationAccessCore } = loadModule('lib/services/invitation-access/invitation-access-core.ts', {
    '@/lib/invitations/validate-service': {}, '@/lib/consultations/identity-utils': {}, '@/lib/services/video-chat': {},
  });
  const fakeDb = { collection: () => ({ doc }), async runTransaction(callback) {
    return callback({ get: (ref) => ref.get(), set: (ref, patch) => ref.set(patch) });
  } };
  const core = new FirestoreInvitationAccessCore(fakeDb, {}, {});
  await assert.rejects(core.markWaitingEntryLeft({ waitingPatientId: 'visit-a', credential: { visitId: 'visit-1' } }), /earlier visit/);
  assert.equal(documents['waitingPatients/visit-a'].status, 'waiting');
  assert.equal((await core.markWaitingEntryLeft({ waitingPatientId: 'visit-a', credential: { visitId: 'visit-2' } })).status, 'left');
});

test('the waiting page mounts no hidden LiveKit room or device preview', () => {
  const source = readFileSync('app/invite/[token]/page.tsx', 'utf8');
  assert.equal(source.match(/<PatientLiveKitRoom/g)?.length, 1, 'Only the visible post-admission room mounts media');
  assert.doesNotMatch(source, /display: 'none' }}>\s*<PatientLiveKitRoom/);
});

test('arrival plan: rejection is sticky, guests never inherit an admission, reconnects keep their visit', () => {
  const { planWaitingArrival } = loadModule('lib/invitations/invitation-use-reservation.ts');
  const plan = (existingStatus, requestedStatus, principalKeyed = true) => ({ ...planWaitingArrival({ existingStatus, requestedStatus, principalKeyed }) });
  assert.deepEqual(plan(null, 'admitted'), { startedNewVisit: true, status: 'admitted' });
  assert.deepEqual(plan('left', 'admitted'), { startedNewVisit: true, status: 'admitted' });
  assert.deepEqual(plan('rejected', 'admitted'), { startedNewVisit: true, status: 'waiting' }, 'Doctor rejection outranks the allowlist');
  assert.deepEqual(plan('waiting', 'admitted'), { startedNewVisit: false, status: 'waiting' });
  assert.deepEqual(plan('admitted', 'waiting', true), { startedNewVisit: false, status: 'admitted' });
  assert.deepEqual(plan('admitted', 'waiting', false), { startedNewVisit: true, status: 'waiting' }, 'Device-keyed guests start over');
  assert.deepEqual(plan('unknown-legacy', 'admitted'), { startedNewVisit: true, status: 'waiting' });
});

test('a typed or link-carried email never selects another visitor\'s queue entry', () => {
  const { resolveWaitingPatientId } = loadModule('lib/invitations/waiting-patient-key.ts', {
    '../security/security-signal': { hashSecuritySignal: (label, value) => `${label}:${value}` },
  });
  const victim = resolveWaitingPatientId({ invitationId: 'inv', principalId: 'uid-victim', networkHash: 'n1', userAgentHash: 'u1' });
  const attacker = resolveWaitingPatientId({ invitationId: 'inv', patientEmail: 'victim@example.test', networkHash: 'n2', userAgentHash: 'u2' });
  const anonymousAccount = resolveWaitingPatientId({ invitationId: 'inv', principalId: 'uid-anon', networkHash: 'n2', userAgentHash: 'u2' });
  assert.notEqual(attacker, victim);
  assert.notEqual(anonymousAccount, attacker, 'A Firebase session outranks the device correlation key');
  const source = readFileSync('lib/invitations/validate-service.ts', 'utf8');
  const call = source.slice(source.indexOf('resolveWaitingPatientId({'), source.indexOf('});', source.indexOf('resolveWaitingPatientId({')));
  assert.doesNotMatch(call, /mail/i, 'No email reaches the entry key');
});

test('a reconnect does not spend or get refused by an exhausted use limit; a new visit does', async () => {
  const h = reservationFixture({ maxUses: 1 });
  assert.equal((await h.arrive('patient-a')).outcome, 'reserved');
  assert.equal((await h.arrive('patient-a')).outcome, 'reserved', 'Same open visit');
  assert.equal(h.invitation().currentUses, 1);
  assert.equal((await h.arrive('patient-b')).outcome, 'unavailable', 'New visit needs a use');
});

test('a rejected verified patient waits again instead of re-entering directly', async () => {
  const h = reservationFixture();
  await h.arrive('verified', 'admitted');
  Object.assign(h.rows.get('waitingPatients/verified'), { status: 'rejected' });
  const again = await h.arrive('verified', 'admitted');
  assert.equal(again.status, 'waiting');
  assert.equal(h.rows.get('waitingPatients/verified').status, 'waiting');
});

/** Core service over a mutable synthetic row, with an optional presence probe. */
function departureHarness(row, connected = false) {
  const documents = { 'waitingPatients/visit-a': { invitationId: 'invite-a', roomName: 'room-a', status: 'admitted', joinedAt: new Date(), ...row } };
  const doc = id => ({ async get() { return { id, exists: true, data: () => documents[`waitingPatients/${id}`] }; },
    async set(patch) { Object.assign(documents[`waitingPatients/${id}`], patch); } });
  const { FirestoreInvitationAccessCore } = loadModule('lib/services/invitation-access/invitation-access-core.ts', {
    '@/lib/invitations/validate-service': {}, '@/lib/consultations/identity-utils': {}, '@/lib/services/video-chat': {},
  });
  const fakeDb = { collection: () => ({ doc }), async runTransaction(callback) {
    return callback({ get: (ref) => ref.get(), set: (ref, patch) => ref.set(patch) });
  } };
  const core = new FirestoreInvitationAccessCore(fakeDb, { async isParticipantConnected() { return connected; } }, {});
  return { core, documents };
}

test('a late or duplicate LiveKit departure cannot close a newer visit or a still-connected patient', async () => {
  const stale = departureHarness({});
  const old = await stale.core.handleParticipantLeftWebhook({ waitingPatientId: 'visit-a', roomName: 'room-a', participantJoinedAt: new Date(Date.now() - 3600000) });
  assert.equal(old.reason, 'earlier_visit_departure_ignored');
  assert.equal(stale.documents['waitingPatients/visit-a'].status, 'admitted');
  const twoDevices = departureHarness({ joinedAt: new Date(Date.now() - 60000) }, true);
  assert.equal((await twoDevices.core.handleParticipantLeftWebhook({ waitingPatientId: 'visit-a', roomName: 'room-a', participantJoinedAt: new Date() })).reason, 'participant_still_connected');
  const real = departureHarness({ joinedAt: new Date(Date.now() - 60000) });
  assert.equal((await real.core.handleParticipantLeftWebhook({ waitingPatientId: 'visit-a', roomName: 'room-a', participantJoinedAt: new Date() })).status, 'left');
});

test('the doctor admits only the visit they reviewed, and legacy status-less invitations stay admittable', async () => {
  const h = admissionHarness({ status: undefined }, { status: 'waiting', currentVisitId: 'visit-2' });
  await assert.rejects(h.service.admitWaitingEntry({ ...admittingInput, expectedVisitId: 'visit-1' }), /new visit/);
  assert.equal(h.documents['waitingPatients/visit-a'].status, 'waiting');
  assert.equal((await h.service.admitWaitingEntry({ ...admittingInput, expectedVisitId: 'visit-2' })).roomName, 'room-a');
});

test('clinician roles: claim accepted; legacy profile role honoured transitionally; unknown role refused', async () => {
  const profiles = { 'uid-legacy': { role: 'doctor' }, 'uid-patient': { role: 'patient' }, 'uid-claimed': { role: 'doctor' }, 'uid-none': { role: 'bogus' } };
  const claims = { 'uid-legacy': {}, 'uid-patient': {}, 'uid-claimed': { role: 'doctor' }, 'uid-none': {} };
  const { authorizeBearerRequest } = loadModule('lib/services/shared/request-auth.ts', {
    '@/lib/firebase-admin': {
      getFirebaseAdmin: () => ({}),
      getFirebaseAdminAuth: () => ({ async verifyIdToken(token) { return { uid: token, email: `${token}@example.test`, email_verified: true, ...claims[token] }; } }),
    },
    '@/lib/auth/access-policy': loadModule('lib/auth/access-policy.ts'),
    '@/lib/auth/role-administration': loadModule('lib/auth/role-administration.ts'),
    '@/lib/repositories/user-repository': { UserRepository: class { async getById(id) { return { exists: !!profiles[id], data: () => profiles[id] }; } } },
    './request-logging': { recordAuthenticatedUser() {} },
    './service-result': loadModule('lib/services/shared/service-result.ts'),
  }, { process: { env: {} } });
  const call = (uid, permission = 'invitation:manage') => authorizeBearerRequest({ headers: new Headers({ authorization: `Bearer ${uid}` }) }, permission);
  assert.equal((await call('uid-claimed')).ok, true);
  assert.equal((await call('uid-legacy')).ok, true, 'Existing doctor accounts keep working until granted a claim');
  assert.equal((await call('uid-patient')).ok, false, 'A patient cannot manage invitations');
  assert.equal((await call('uid-none')).error.code, 'role_required');
});

test('the summary editor shows Unknown instead of defaulting an unestablished risk to Low', () => {
  const source = readFileSync('app/doctor/dashboard/page.tsx', 'utf8');
  assert.match(source, /<option value="Unknown">/);
  assert.match(source, /\['Low', 'Medium', 'High'\]\.includes\(summary\.riskLevel \|\| ''\) \? summary\.riskLevel : 'Unknown'/);
});

test('role administration: super admin bootstrap, clinic-scoped admins, nobody changes their own role', () => {
  const { decideRoleChange, parseSuperAdminEmails, administratorLevel, normalizeClinicId } = loadModule('lib/auth/role-administration.ts');
  const supers = parseSuperAdminEmails(' Owner@Clinic.test, other@clinic.test ');
  const superAdmin = { userId: 'u-super', email: 'owner@clinic.test', emailVerified: true, isAdminClaim: false };
  const unverified = { ...superAdmin, emailVerified: false };
  const clinicAdmin = { userId: 'u-admin', email: 'a@clinic.test', emailVerified: true, isAdminClaim: true, clinicId: 'north-dental' };
  const doctor = { userId: 'u-doc', email: 'd@clinic.test', emailVerified: true, isAdminClaim: false };
  assert.equal(administratorLevel(superAdmin, supers), 'super_admin');
  assert.equal(administratorLevel(unverified, supers), null, 'An unverified email never bootstraps');
  assert.equal(normalizeClinicId(' Henry Cheung Dental '), 'henry-cheung-dental');
  const decide = (caller, role, extra = {}) => decideRoleChange({ caller, superAdminEmails: supers, targetUserId: 'u-target', role, action: 'grant', ...extra });
  assert.equal(decide(superAdmin, 'admin', { clinicId: 'north-dental' }).allowed, true);
  assert.equal(decide(superAdmin, 'doctor').allowed, false, 'Every grant names a clinic');
  assert.equal(decide(clinicAdmin, 'doctor').clinicId, 'north-dental', 'Clinic admin grants into own clinic');
  assert.equal(decide(clinicAdmin, 'doctor', { clinicId: 'south-dental' }).allowed, false, 'Not into another clinic');
  assert.equal(decide(clinicAdmin, 'doctor', { targetClinicId: 'south-dental' }).allowed, false, 'Not a doctor of another clinic');
  assert.equal(decideRoleChange({ caller: clinicAdmin, superAdminEmails: supers, targetUserId: 'u-target', role: 'doctor', action: 'revoke', targetClinicId: 'south-dental' }).allowed, false);
  assert.equal(decide(clinicAdmin, 'admin', { clinicId: 'north-dental' }).allowed, false);
  assert.equal(decide(doctor, 'doctor', { clinicId: 'north-dental' }).allowed, false);
  assert.equal(decideRoleChange({ caller: superAdmin, superAdminEmails: supers, targetUserId: 'u-super', role: 'doctor', action: 'grant', clinicId: 'x-clinic' }).allowed, false, 'No self change');
});

test('visits are counted by identification kind, once per new visit', async () => {
  const h = reservationFixture();
  await h.arrive('guest-1');
  await h.arrive('guest-1');
  assert.equal(h.invitation()['visitStats.total'], 1, 'Reconnect is not a new visit');
  assert.equal(h.invitation()['visitStats.guests'], 1);
  const { formatVisitBreakdown } = loadModule('lib/invitations/invitation-presentation.ts', {
    '@/lib/invitations/invitation-use-reservation': { REUSABLE_INVITATION_MAX_USES: 999999 },
  });
  assert.equal(formatVisitBreakdown({ total: 3, verifiedAccounts: 1, guests: 2 }), '3 visits · 1 verified account · 2 guests');
  assert.equal(formatVisitBreakdown({}), null);
});

test('waiting limit changes are owner-only, clamped 1-100, and only on active waiting-room invitations', () => {
  const source = readFileSync('app/api/invite/limit/route.ts', 'utf8');
  assert.match(source, /authorizeBearerRequest\(req, 'invitation:manage'\)/);
  assert.match(source, /createdBy !== auth\.data\.userId/);
  assert.match(source, /Math\.min\(MAX_WAITING_LIMIT, Math\.max\(MIN_WAITING_LIMIT, requested\)\)/);
  assert.match(source, /runTransaction/);
  assert.doesNotMatch(source, /^export const (MIN|MAX)/m, 'Route modules export only handlers');
});

test('room media uses adaptive stream, dynacast, simulcast and browser speech processing', () => {
  const source = readFileSync('app/room/[room]/components/shared/RoomShell.tsx', 'utf8');
  for (const option of ['adaptiveStream: true', 'dynacast: true', 'simulcast: true', 'echoCancellation: true', 'noiseSuppression: true']) {
    assert.ok(source.includes(option), option);
  }
  assert.match(source, /options=\{ROOM_MEDIA_OPTIONS\}/);
});

test('two guests on the same network and browser get separate entries via the per-tab id', () => {
  const { resolveWaitingPatientId } = loadModule('lib/invitations/waiting-patient-key.ts', {
    '../security/security-signal': { hashSecuritySignal: (label, value) => `${label}:${value}` },
  });
  const tab = (browserSessionHash) => resolveWaitingPatientId({ invitationId: 'inv', networkHash: 'n', userAgentHash: 'u', browserSessionHash });
  assert.notEqual(tab('tab-a'), tab('tab-b'));
  assert.equal(tab('tab-a'), tab('tab-a'), 'A reload in the same tab keeps its entry');
});

test('only a super admin can change an administrator account; only privilege-removing changes sign anyone out', () => {
  const { decideRoleChange } = loadModule('lib/auth/role-administration.ts');
  const clinicAdmin = { userId: 'u-admin', email: 'a@x.test', emailVerified: true, isAdminClaim: true, clinicId: 'north-dental' };
  const result = decideRoleChange({ caller: clinicAdmin, superAdminEmails: new Set(), targetUserId: 'u-other-admin', role: 'doctor', action: 'revoke', targetClinicId: 'north-dental', targetIsAdmin: true });
  assert.equal(result.allowed, false);
  const route = readFileSync('app/api/admin/roles/route.ts', 'utf8');
  assert.match(route, /if \(action === 'revoke' \|\| grantRemovesPrivilege\) \{[\s\S]*revokeRefreshTokens/);
  assert.match(route, /wasAdministrator && role !== 'admin'/, 'Admin -> doctor ends the admin token');
  assert.match(route, /role === 'admin' && previousRole === 'doctor'/, 'Doctor -> admin ends the clinical token');
  assert.match(route, /claims\.role = role;/, 'Administrator grants must not silently grant Doctor');
});

test('every new invitation uses the waiting room, and stale doctor tokens are not reused', () => {
  assert.match(readFileSync('app/api/invite/create/route.ts', 'utf8'), /const isWaitingRoomEnabled = true;/);
  assert.match(readFileSync('app/room/[room]/doctor/hooks/useDoctorToken.ts', 'utf8'), /isUsableDoctorToken\(savedToken, user\?\.uid\)/);
});

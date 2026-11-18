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
  assert.equal(sourceText.match(/onDisconnected=\{handleRoomDisconnect\}/g)?.length, 2);

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
    assert.equal(input.roomName, 'room-a');
    assert.equal(input.subject, 'patient_invite-a_visit-a');
    return 'synthetic-consultation-token';
  } }, {});
  service.appendSessionModerationEvent = async () => {};
  return { service, documents, counts: () => ({ tokens, writes }) };
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
  assert.equal(source.match(/purpose: 'waiting'/g)?.length, 2, 'Both initial and reconnect waiting grants are media-disabled');
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
  }).outputText, { exports, AbortController, console: { error() {}, log() {} }, ...globals });
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
  }, { window: {
    setInterval(fn) { const id = timers.size + 1; timers.set(id, fn); return id; },
    clearInterval(id) { timers.delete(id); },
  } });
  return {
    ...coordinator, timers,
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

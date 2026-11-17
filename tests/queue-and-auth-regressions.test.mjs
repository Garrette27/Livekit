import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { DisconnectReason } from 'livekit-client';

/** Execute real TypeScript modules with isolated IO adapters and synthetic data. */
function loadModule(path, dependencies = {}, globals = {}) {
  const moduleRecord = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    module: moduleRecord, exports: moduleRecord.exports, Date, Headers, FormData, Blob, AbortSignal,
    console: { warn() {}, error() {} },
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

function queueHarness() {
  let snapshotCallback;
  let errorCallback;
  let listenerCount = 0;
  let unsubscribed = 0;
  const timers = new Map();
  const coordinator = loadModule('lib/waiting-room/waiting-queue-coordinator.ts', {
    '@/lib/firebase': { db: {} },
    'firebase/firestore': {
      collection: () => ({}), where: () => ({}), query: () => ({}),
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
  return { collection: name => query(collections[name] || []) };
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
      { ...active, id: 'other-doctor', createdBy: 'd2' }],
    waitingPatients: [{ ...row, id: 'current' },
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
  assert.deepEqual(Array.from(rows, item => item.id), ['current']);
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

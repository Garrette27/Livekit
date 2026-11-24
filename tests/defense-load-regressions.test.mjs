import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createHmac } from 'node:crypto';

function loadModule(path, dependencies = {}, globals = {}) {
  const record = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    module: record, exports: record.exports, Date, Headers,
    console: { log() {}, warn() {}, error() {} },
    require(name) { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; },
    ...globals,
  }, { filename: path });
  return record.exports;
}

const resultHelpers = loadModule('lib/services/shared/service-result.ts');
const identity = loadModule('lib/consultations/identity-utils.ts');

test('same-room credentials cannot access a different recorded principal', async () => {
  let credential = { identity: 'patient_guest-b', roomName: 'synthetic-room', issuedAt: 100 };
  let session = { roomName: 'synthetic-room', doctorUserId: 'doctor-a', patientUserId: 'patient_guest-a' };
  const { authorizeSessionParticipant } = loadModule('lib/services/shared/session-participant-auth.ts', {
    '@/lib/invitations/token-utils': { verifyLiveKitRoomToken: () => credential },
    '@/lib/repositories/consultation-session-repository': { ConsultationSessionRepository: class { async getById() { return { exists: true, data: () => session }; } } },
    '@/lib/consultations/identity-utils': identity,
    './service-result': resultHelpers,
  });
  const authorize = () => authorizeSessionParticipant(new Request('https://synthetic.invalid', { headers: { authorization: 'Bearer synthetic' } }), {}, 'session-a');
  assert.equal((await authorize()).ok, false, 'Another guest in the same room must not own this encounter');
  credential = { ...credential, identity: 'patient_guest-a' };
  assert.equal((await authorize()).ok, true, 'Server-recorded guest transport identity still works');
  credential = { ...credential, identity: 'patient_other', patientUserId: 'uid-a' };
  session = { ...session, patientUserId: 'uid-a' };
  assert.equal((await authorize()).ok, true, 'A signed Firebase binding owns its recorded encounter');
  session = { ...session, metadata: { patientUserId: 'uid-b' } };
  assert.equal((await authorize()).ok, false, 'Conflicting legacy identity fields fail closed');
  credential = { identity: 'doctor_doctor-b', roomName: 'synthetic-room' };
  assert.equal((await authorize()).ok, false, 'A prior/other room owner cannot access this doctor-owned encounter');
  credential = { identity: 'doctor_doctor-a', roomName: 'synthetic-room' };
  assert.equal((await authorize()).ok, true);
});

test('ten browser participants persist only their own 200 total chat messages, not 2,000 copies', async () => {
  const path = 'app/room/[room]/components/shared/RoomShell.tsx';
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ChatPersistenceBridge');
  assert.ok(declaration);
  const messages = Array.from({ length: 200 }, (_, i) => ({ id: `message-${i}`, message: 'synthetic text', timestamp: 1000 + i, from: { identity: `participant-${i % 10}`, name: 'Synthetic' } }));
  const posts = [];
  for (let participant = 0; participant < 10; participant++) {
    const effects = [];
    const exports = {};
    runInNewContext(ts.transpileModule(`export ${declaration.getText(source)}`, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, {
      exports, useChat: () => ({ chatMessages: messages }),
      useLocalParticipant: () => ({ localParticipant: { identity: `participant-${participant}` } }),
      React: { useRef: value => ({ current: value }), useEffect: fn => effects.push(fn) },
      toChatTimestampKey: value => value, inferSenderType: () => 'patient',
      fetch: async (_url, options) => { posts.push(JSON.parse(options.body)); return { ok: true }; }, console,
    });
    exports.ChatPersistenceBridge({ enabled: true, consultationSessionId: 'synthetic-session', accessToken: 'synthetic' });
    effects.forEach(effect => effect());
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(posts.length, 200);
  const counts = new Map();
  posts.forEach(post => counts.set(post.messageId, (counts.get(post.messageId) || 0) + 1));
  assert.equal(counts.size, 200);
  assert.ok([...counts.values()].every(value => value === 1));
});

/** Adapter models document atomicity; it is not a cloud throughput benchmark. */
function documentAdapter() {
  const documents = new Map();
  let tail = Promise.resolve();
  let sessionTouches = 0;
  const snapshot = path => ({ id: path.split('/').at(-1), exists: documents.has(path), data: () => documents.get(path) });
  const write = (ref, value) => { documents.set(ref.path, value); if (ref.path === 'consultationSessions/synthetic') sessionTouches++; };
  const reference = path => ({ path, id: path.split('/').at(-1),
    collection: name => collection(`${path}/${name}`),
    get: async () => snapshot(path), set: async value => write({ path }, value),
  });
  const collection = path => ({ doc: id => reference(`${path}/${id}`) });
  const db = { collection, runTransaction: callback => {
    const work = tail.then(() => callback({ get: async ref => snapshot(ref.path), create: write, set: write, update: write }));
    tail = work.catch(() => {});
    return work;
  } };
  return { db, documents, touches: () => sessionTouches };
}

test('100 simultaneous keyed retries create one message and touch the session once', async () => {
  const adapter = documentAdapter();
  const { FirestoreChatMessageStore } = loadModule('lib/services/video-chat/chat-message-store.ts', {
    'firebase-admin/firestore': { FieldValue: { serverTimestamp: () => 'synthetic-time' }, Timestamp: { now: () => 'synthetic-time' } },
    '@/lib/chat/session-chat-model': { isMessageVisibleForParticipant: () => true },
    '@/lib/chat/chat-message-key': { toChatMessageDocumentId: key => key },
  });
  const store = new FirestoreChatMessageStore(adapter.db);
  const results = await Promise.all(Array.from({ length: 100 }, () => store.appendMessage({ sessionId: 'synthetic', messageId: 'one-message', senderId: 'patient-a', senderName: 'Synthetic', senderType: 'patient', message: 'synthetic text' })));
  assert.equal(results.filter(result => !result.duplicated).length, 1);
  assert.equal(adapter.touches(), 1);
  assert.equal(adapter.documents.get('consultationSessions/synthetic/messages/one-message').senderId, 'patient-a');
});

test('100 history records enrich chat with at most six outstanding reads and preserve every record', async () => {
  let active = 0, peak = 0, readCount = 0;
  const documents = Array.from({ length: 100 }, (_, index) => ({ id: `session-${index}`, data: () => ({ roomName: 'synthetic', doctorUserId: 'doctor-a', status: 'completed', sessionStartedAt: '2026-01-01T00:00:00Z', sessionEndedAt: '2026-01-01T00:01:00Z' }) }));
  const db = { collection(name) {
    assert.equal(name, 'consultationSessions');
    return { doc() { return { collection(name) {
      assert.equal(name, 'messages');
      return { orderBy() { return { limit(value) { assert.equal(value, 500); return { async get() {
        active++; peak = Math.max(peak, active); readCount++;
        await new Promise(resolve => setImmediate(resolve)); active--;
        return { empty: true, docs: [] };
      } }; } }; } };
    } }; } };
  } };
  const { FirestoreSummaryProjectionService } = loadModule('lib/services/history-summary/summary-projection-service.ts', {
    '@/lib/consultations/identity-utils': identity,
    '@/lib/services/consultation-finalization': { generateAndStoreConsultationSummary: async () => { throw new Error('History must never call AI'); } },
    '@/lib/repositories/call-summary-repository': { CallSummaryRepository: class { async findByDoctor() { return []; } } },
    '@/lib/repositories/consultation-session-repository': { ConsultationSessionRepository: class { async findByDoctor() { return documents; } } },
    '@/lib/repositories/user-repository': { UserRepository: class { async getEmail() { return 'synthetic@example.invalid'; } } },
  });
  const history = await new FirestoreSummaryProjectionService(db).buildDoctorHistory({ doctorUserId: 'doctor-a', includeChatHistory: true });
  assert.equal(history.length, 100);
  assert.equal(readCount, 100);
  assert.ok(peak <= 6, `Observed ${peak} concurrent reads`);
});

test('queue departure cannot overwrite the current encounter principal or close a later visit', async () => {
  for (const queuePatientId of ['anonymous_old', 'registered-old']) {
    const adapter = documentAdapter();
    const current = { roomName: 'synthetic-room', consultationSessionId: 'current-session', patientUserId: 'patient_current', doctorUserId: 'doctor-a', status: 'active', sessionStartedAt: new Date() };
    adapter.documents.set('consultations/synthetic-room', current);
    adapter.documents.set('consultationSessions/current-session', current);
    adapter.documents.set('waitingPatients/old-entry', { patientId: queuePatientId, invitationId: 'old-invite', roomName: 'synthetic-room', doctorUserId: 'doctor-a', status: 'admitted', joinedAt: new Date(), metadata: {} });
    const { FirestoreInvitationAccessCore } = loadModule('lib/services/invitation-access/invitation-access-core.ts', {
      '@/lib/invitations/validate-service': {}, '@/lib/consultations/identity-utils': identity,
      '@/lib/services/video-chat': {}, '@/lib/services/shared/database-availability': {},
    });
    const queue = new FirestoreInvitationAccessCore(adapter.db, {}, { closeSession: async () => {}, appendEvent: async () => {} });
    await queue.markWaitingEntryLeft({ waitingPatientId: 'old-entry' });
    assert.equal(adapter.documents.get('waitingPatients/old-entry').status, 'left');
    assert.equal(adapter.documents.get('consultations/synthetic-room').patientUserId, 'patient_current');
    assert.equal(adapter.documents.get('consultations/synthetic-room').status, 'active');
    assert.equal(adapter.documents.get('consultationSessions/current-session').patientUserId, 'patient_current');
  }
});

test('a buffered local message is never reassigned after the encounter prop changes', async () => {
  const path = 'app/room/[room]/components/shared/RoomShell.tsx';
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ChatPersistenceBridge');
  const refs = [], effects = [], posts = [];
  let refIndex = 0;
  let messages = [{ id: 'old-message', message: 'synthetic old text', timestamp: 1, from: { identity: 'patient-a' } }];
  const exports = {};
  runInNewContext(ts.transpileModule(`export ${declaration.getText(source)}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, useChat: () => ({ chatMessages: messages }),
    useLocalParticipant: () => ({ localParticipant: { identity: 'patient-a' } }),
    React: { useRef(value) { const i = refIndex++; return refs[i] || (refs[i] = { current: value }); }, useEffect: fn => effects.push(fn) },
    toChatTimestampKey: value => value, inferSenderType: () => 'patient',
    fetch: async (_url, options) => { posts.push(JSON.parse(options.body)); return { ok: true }; },
    console: { error() {} },
  });
  async function render(session) {
    refIndex = 0; effects.length = 0;
    exports.ChatPersistenceBridge({ enabled: true, consultationSessionId: session, accessToken: 'synthetic' });
    effects.forEach(effect => effect());
    await new Promise(resolve => setImmediate(resolve));
  }
  await render('session-old');
  messages = [...messages, { id: 'new-message', message: 'synthetic new text', timestamp: 2, from: { identity: 'patient-a' } }];
  await render('session-new');
  assert.deepEqual(posts.map(post => [post.messageId, post.consultationSessionId]), [['old-message', 'session-old'], ['new-message', 'session-new']]);
});

test('authenticated operation budgets isolate two principals behind the same clinic network', async () => {
  for (const database of [documentAdapter().db, null, { collection() { return { doc() { return {}; } }; }, async runTransaction() { throw new Error('synthetic outage'); } }]) {
    const { enforceRateLimit } = loadModule('lib/rate-limit.ts', {
      'next/server': {}, 'node:crypto': { createHmac }, '@/lib/firebase-admin': { getFirebaseAdmin: () => database },
    }, { process: { env: { RATE_LIMIT_HASH_SECRET: 'synthetic-test-secret' } }, Response,
      setInterval: () => ({ unref() {} }) });
    const request = { nextUrl: { pathname: '/api/session-chat/messages' }, headers: new Headers({ 'x-forwarded-for': '192.0.2.1' }) };
    const config = { limit: 2, windowMs: 60000 };
    assert.equal(await enforceRateLimit(request, config, 'patient-a:session-a'), null);
    assert.equal(await enforceRateLimit(request, config, 'patient-a:session-a'), null);
    const refused = await enforceRateLimit(request, config, 'patient-a:session-a');
    assert.equal(refused.status, 429);
    assert.ok(Number(refused.headers.get('retry-after')) > 0);
    assert.equal(await enforceRateLimit(request, config, 'patient-b:session-b'), null);
  }
});

test('guest principal stays authorized when the queue notice arrives before or after a scoped request', async () => {
  for (const queueFirst of [true, false]) {
    const adapter = documentAdapter();
    const session = { roomName: 'synthetic-room', patientUserId: 'patient_guest-current', status: 'active' };
    adapter.documents.set('consultations/synthetic-room', { ...session, consultationSessionId: 'session-current' });
    adapter.documents.set('consultationSessions/session-current', session);
    adapter.documents.set('waitingPatients/current-entry', { patientId: 'anonymous_current', invitationId: 'invite-current', roomName: 'synthetic-room', status: 'admitted', joinedAt: new Date(), metadata: {} });
    const { FirestoreInvitationAccessCore } = loadModule('lib/services/invitation-access/invitation-access-core.ts', {
      '@/lib/invitations/validate-service': {}, '@/lib/consultations/identity-utils': identity,
      '@/lib/services/video-chat': {}, '@/lib/services/shared/database-availability': {},
    });
    const { authorizeSessionParticipant } = loadModule('lib/services/shared/session-participant-auth.ts', {
      '@/lib/invitations/token-utils': { verifyLiveKitRoomToken: () => ({ identity: 'patient_guest-current', roomName: 'synthetic-room' }) },
      '@/lib/repositories/consultation-session-repository': { ConsultationSessionRepository: class { async getById() { return { exists: true, data: () => adapter.documents.get('consultationSessions/session-current') }; } } },
      '@/lib/consultations/identity-utils': identity, './service-result': resultHelpers,
    });
    const queue = new FirestoreInvitationAccessCore(adapter.db, {}, { appendEvent: async () => {} });
    const authorize = () => authorizeSessionParticipant(new Request('https://synthetic.invalid', { headers: { authorization: 'Bearer synthetic' } }), adapter.db, 'session-current');
    if (queueFirst) await queue.markWaitingEntryLeft({ waitingPatientId: 'current-entry' });
    assert.equal((await authorize()).ok, true);
    if (!queueFirst) await queue.markWaitingEntryLeft({ waitingPatientId: 'current-entry' });
    assert.equal((await authorize()).ok, true);
    assert.equal(adapter.documents.get('consultationSessions/session-current').patientUserId, 'patient_guest-current');
  }
});

test('chat persistence honors its authenticated rate refusal before writing a message', async () => {
  let writes = 0, budgetCalls = 0;
  const route = loadModule('app/api/session-chat/messages/route.ts', {
    '@/lib/services/shared/request-logging': { withRequestLogging: fn => fn },
    'next/server': { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), init) } },
    '@/lib/firebase-admin': { getFirebaseAdmin: () => ({}) },
    '@/lib/services/video-chat': { FirestoreChatMessageStore: class { async appendMessage() { writes++; return { messageId: 'synthetic', duplicated: false }; } } },
    '@/lib/services/shared/session-participant-auth': { authorizeSessionParticipant: async () => ({ ok: true, data: { identity: 'patient-a', participantType: 'patient', participantName: 'Synthetic' } }) },
    '@/lib/services/shared/http': { serviceResultToResponse: () => { throw new Error('Unexpected auth denial'); }, unexpectedErrorResponse: error => { throw error; } },
    '@/lib/chat/chat-message-key': { MAX_CHAT_MESSAGE_LENGTH: 4000 },
    '@/lib/consultations/consultation-capabilities': { isConsultationCapabilityEnabled: () => false },
    '@/lib/repositories/attachment-repository': {},
    '@/lib/rate-limit': { RateLimitConfigs: { CHAT_WRITE: { limit: 60, windowMs: 60000 } }, enforceRateLimit: async (_request, _config, subject) => {
      assert.equal(subject, 'patient-a:session-a'); budgetCalls++;
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
    } },
  }, { Response });
  const response = await route.POST(new Request('https://synthetic.invalid/api/session-chat/messages', { method: 'POST', body: JSON.stringify({ consultationSessionId: 'session-a', text: 'synthetic text' }) }));
  assert.equal(response.status, 429);
  assert.equal(writes, 0);
  assert.equal(budgetCalls, 1);
});

test('manual summary rate refusal prevents another provider-generation attempt', async () => {
  let generations = 0;
  const route = loadModule('app/api/summary/generate/route.ts', {
    'next/server': {}, '@/lib/firebase-admin': { getFirebaseAdmin: () => ({}) },
    '@/lib/repositories/consultation-session-repository': { ConsultationSessionRepository: class { async getById() { return { exists: true, data: () => ({ doctorUserId: 'doctor-a', status: 'completed' }) }; } } },
    '@/lib/services/history-summary': { FirestoreSummaryProjectionService: class { async buildSummary() { generations++; return { summaryId: 'session-a', summary: { synthetic: true } }; } } },
    '@/lib/services/shared/http': { serviceResultToResponse: result => new Response(JSON.stringify(result), { status: result.ok ? 200 : result.error.status }) },
    '@/lib/services/shared/request-auth': { authorizeBearerRequest: async () => ({ ok: true, data: { userId: 'doctor-a', role: 'doctor' } }) },
    '@/lib/services/shared/request-logging': { withRequestLogging: fn => fn },
    '@/lib/services/shared/service-result': resultHelpers,
    '@/lib/rate-limit': { RateLimitConfigs: { SUMMARY_GENERATION: { limit: 3, windowMs: 60000 } }, enforceRateLimit: async (_request, _config, subject) => {
      assert.equal(subject, 'doctor-a'); return new Response('{}', { status: 429 });
    } },
  });
  const response = await route.POST(new Request('https://synthetic.invalid/api/summary/generate', { method: 'POST', body: JSON.stringify({ consultationSessionId: 'session-a' }) }));
  assert.equal(response.status, 429);
  assert.equal(generations, 0);
});

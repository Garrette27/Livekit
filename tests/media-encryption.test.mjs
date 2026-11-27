import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import jwt from 'jsonwebtoken';

const require = createRequire(import.meta.url);
const transpile = (path) => ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

function load(path, modules, env) {
  const record = { exports: {} };
  runInNewContext(transpile(path), {
    module: record, exports: record.exports, process: { env }, Buffer, URL, Date, JSON, String, Number, Error, console,
    require: (name) => modules[name] ?? require(name),
  });
  return record.exports;
}

const env = { LIVEKIT_API_SECRET: 'provider-secret-provider-secret-1234', LIVEKIT_API_KEY: 'APIkey' };
const tokenUtils = load('lib/invitations/token-utils.ts', {}, env);
const media = load('lib/livekit/media-encryption.ts', { '@/lib/invitations/token-utils': tokenUtils }, env);
const consultation = (room) => tokenUtils.signLiveKitRoomToken({ subject: 'patient_inv_1_w1', roomName: room });

test('E2EE off: a valid consultation credential learns E2EE is disabled, and gets no key', () => {
  delete env.LIVEKIT_E2EE_SECRET;
  const result = media.issueRoomMediaKey(consultation('room-a'));
  assert.equal(result.status, 200);
  assert.deepEqual({ ...result.body }, { success: true, enabled: false });
});

test('E2EE on: every participant of a room derives the same key; another room gets a different key', () => {
  env.LIVEKIT_E2EE_SECRET = 'e2ee-secret-e2ee-secret-e2ee-secret-0001';
  const doctor = media.issueRoomMediaKey(tokenUtils.signLiveKitRoomToken({ subject: 'doctor_1', roomName: 'room-a' }));
  const patient = media.issueRoomMediaKey(consultation('room-a'));
  const other = media.issueRoomMediaKey(consultation('room-b'));
  assert.equal(doctor.body.enabled, true);
  assert.equal(doctor.body.key, patient.body.key);
  assert.notEqual(doctor.body.key, other.body.key);
  assert.ok(Buffer.from(doctor.body.key, 'base64url').length === 32);
});

test('the media key is not derivable from the provider API secret', () => {
  env.LIVEKIT_E2EE_SECRET = 'e2ee-secret-e2ee-secret-e2ee-secret-0001';
  const key = media.issueRoomMediaKey(consultation('room-a')).body.key;
  assert.notEqual(key, media.deriveRoomMediaKey('room-a', env.LIVEKIT_API_SECRET));
});

test('waiting-room credentials, forged and missing credentials never receive a key', () => {
  env.LIVEKIT_E2EE_SECRET = 'e2ee-secret-e2ee-secret-e2ee-secret-0001';
  const waiting = tokenUtils.signLiveKitRoomToken({ subject: 'patient_inv_1_w1', roomName: 'room-a-waiting', purpose: 'waiting' });
  assert.equal(media.issueRoomMediaKey(waiting).status, 403);
  const forged = jwt.sign({ sub: 'x', video: { roomJoin: true, room: 'room-a', canPublish: true, canSubscribe: true } }, 'not-the-secret', { issuer: 'APIkey' });
  assert.equal(media.issueRoomMediaKey(forged).status, 401);
  assert.equal(media.issueRoomMediaKey(undefined).status, 401);
});

test('a short E2EE secret is refused rather than weakening every key', () => {
  env.LIVEKIT_E2EE_SECRET = 'short';
  assert.throws(() => media.issueRoomMediaKey(consultation('room-a')), /at least 32/);
  delete env.LIVEKIT_E2EE_SECRET;
});

test('the room never silently downgrades: unsupported browsers are told, not joined in plaintext', () => {
  const client = readFileSync('lib/livekit/media-encryption-client.ts', 'utf8');
  assert.match(client, /!isE2EESupported\(\)\)\s*{\s*return { kind: 'unsupported' }/);
  assert.match(client, /encryption: { keyProvider, worker }/);
  const shell = readFileSync('app/room/[room]/components/shared/RoomShell.tsx', 'utf8');
  assert.match(shell, /room={preparation.room}/);
  assert.doesNotMatch(shell, /options={ROOM_MEDIA_OPTIONS}/);
});

test('database quota errors become 503 + Retry-After instead of a 500 retry storm', async () => {
  const logging = load('lib/services/shared/request-logging.ts', {
    'node:async_hooks': require('node:async_hooks'),
    'next/server': { NextResponse: { json: (body, init = {}) => new Response(JSON.stringify(body), { status: init.status ?? 200, headers: init.headers }) } },
  }, {});
  const quota = Object.assign(new Error('8 RESOURCE_EXHAUSTED: Quota exceeded.'), { code: 8 });
  const originalLog = console.log;
  const lines = [];
  console.log = (line) => lines.push(line);
  try {
    const response = await logging.withRequestLogging(async () => { throw quota; })(new Request('https://example.test/api/account/access'));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Retry-After'), '60');
    assert.equal((await response.json()).code, 'service_busy');
    assert.doesNotMatch(lines.join('\n'), /"stack"/);
  } finally {
    console.log = originalLog;
  }
});

test('access checks are shared and polls back off and pause in hidden tabs', () => {
  const access = readFileSync('lib/auth/workspace-client.ts', 'utf8');
  assert.match(access, /sharedByUser/);
  assert.match(access, /Retry-After/);
  const invite = readFileSync('app/invite/[token]/page.tsx', 'utf8');
  assert.match(invite, /visibilityState !== 'visible'/);
  assert.doesNotMatch(invite, /setInterval\(checkAdmission/);
  assert.match(readFileSync('hooks/useSessionChat.ts', 'utf8'), /visibilityState === 'visible'/);
});

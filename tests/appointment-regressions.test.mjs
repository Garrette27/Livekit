import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

export function loadAppointmentModule(path, dependencies = {}, globals = {}) {
  if (!existsSync(path)) return {};
  const moduleRecord = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module: moduleRecord, exports: moduleRecord.exports, Date, Intl, console: { warn() {}, error() {} }, require: (name) => { assert.ok(name in dependencies, name); return dependencies[name]; }, ...globals });
  return moduleRecord.exports;
}
const policy = () => loadAppointmentModule('lib/appointments/appointment-policy.ts');
const now = new Date('2026-11-27T00:00:00Z');
const create = { action: 'create', id: '11111111-1111-4111-8111-111111111111', patientName: 'Synthetic patient', patientEmail: 'patient@example.test', localStart: '2026-11-28T10:00', durationMinutes: 30, displayTimeZone: 'Asia/Manila' };

test('appointment commands normalize a future clinic-local booking without accepting ownership from the client', () => {
  const { parseAppointmentCommand } = policy();
  assert.equal(typeof parseAppointmentCommand, 'function', 'Scheduling policy is not implemented yet');
  const parsed = parseAppointmentCommand(create, now);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.startsAt, '2026-11-28T02:00:00.000Z');
  assert.equal(parsed.data.endsAt, '2026-11-28T02:30:00.000Z');
  assert.equal(parsed.data.patientEmail, 'patient@example.test');
  assert.equal(parseAppointmentCommand({ ...create, doctorUserId: 'someone-else' }, now).ok, false);
});

test('malformed, oversized, past and excessive appointment commands fail before any transaction', () => {
  const { parseAppointmentCommand } = policy();
  assert.equal(typeof parseAppointmentCommand, 'function');
  for (const value of [null, [], {}, { ...create, id: '../other' }, { ...create, patientName: '' }, { ...create, patientName: 'x'.repeat(101) }, { ...create, patientEmail: 'not-an-email' }, { ...create, durationMinutes: 14 }, { ...create, durationMinutes: 121 }, { ...create, durationMinutes: NaN }, { ...create, localStart: '2026-02-30T10:00' }, { ...create, action: 'reschedule', expectedVersion: 1, localStart: '2026-11-26T10:00' }, { ...create, localStart: '2028-01-01T10:00' }, { ...create, displayTimeZone: 'imaginary/zone' }]) {
    assert.equal(parseAppointmentCommand(value, now).ok, false);
  }
  assert.equal(parseAppointmentCommand({ ...create, patientEmail: '', durationMinutes: 15 }, now).ok, true);
  assert.equal(parseAppointmentCommand({ ...create, durationMinutes: 120 }, now).ok, true);
});

test('timezone conversion rejects DST gaps and ambiguous local wall times', () => {
  const { localAppointmentTimeToUtc } = policy();
  assert.equal(typeof localAppointmentTimeToUtc, 'function');
  assert.equal(localAppointmentTimeToUtc('2026-11-28T10:00', 'Asia/Manila').toISOString(), '2026-11-28T02:00:00.000Z');
  assert.equal(localAppointmentTimeToUtc('2026-07-01T10:00', 'America/New_York').toISOString(), '2026-07-01T14:00:00.000Z');
  assert.throws(() => localAppointmentTimeToUtc('2026-03-08T02:30', 'America/New_York'), /exist|ambiguous/i);
  assert.throws(() => localAppointmentTimeToUtc('2026-11-01T01:30', 'America/New_York'), /exist|ambiguous/i);
  assert.throws(() => localAppointmentTimeToUtc('2026-11-28T10:00', '+05:30'), /named|zone|IANA/i);
});

test('a past create intent can reach its immutable receipt; only new bookings are rejected as past by persistence', () => {
  assert.equal(policy().parseAppointmentCommand({ ...create, localStart: '2026-11-26T10:00' }, now).ok, true);
});

test('a scoped authenticated request cannot borrow a newly signed-in account or send an old token after switching', async () => {
  let sends = 0;
  let release;
  const auth = { currentUser: { uid: 'doctor-a', getIdToken: async () => 'synthetic-token' } };
  const { authenticatedFetch } = loadAppointmentModule('lib/auth/authenticated-fetch.ts', { '@/lib/firebase': { auth } }, { Headers, fetch: async () => { sends++; return { status: 200 }; } });
  await assert.rejects(authenticatedFetch('/api/doctor/appointments', {}, 'doctor-b'), /account|identity|changed/i);
  auth.currentUser.getIdToken = () => new Promise((resolve) => { release = resolve; });
  const pending = authenticatedFetch('/api/doctor/appointments', {}, 'doctor-a');
  auth.currentUser = { uid: 'doctor-b', getIdToken: async () => 'synthetic-token-b' };
  release('synthetic-token-a');
  await assert.rejects(pending, /account|identity|changed/i);
  assert.equal(sends, 0);
});

test('booking intervals overlap only when they share actual time, not at adjacent boundaries', () => {
  const { appointmentsOverlap } = policy();
  assert.equal(typeof appointmentsOverlap, 'function');
  assert.equal(appointmentsOverlap(100, 200, 200, 300), false);
  assert.equal(appointmentsOverlap(100, 200, 199, 300), true);
  assert.equal(appointmentsOverlap(100, 200, 110, 120), true);
});

test('reschedule and cancellation require an explicit positive expected version', () => {
  const { parseAppointmentCommand } = policy();
  assert.equal(typeof parseAppointmentCommand, 'function');
  assert.equal(parseAppointmentCommand({ ...create, action: 'reschedule' }, now).ok, false);
  assert.equal(parseAppointmentCommand({ ...create, action: 'reschedule', expectedVersion: 1 }, now).ok, true);
  assert.equal(parseAppointmentCommand({ action: 'cancel', id: create.id, expectedVersion: 0 }, now).ok, false);
  assert.equal(parseAppointmentCommand({ action: 'cancel', id: create.id, expectedVersion: 2 }, now).ok, true);
});

function appointmentRoute({ role = 'doctor', enabled = true, authenticated = true } = {}) {
  const access = loadAppointmentModule('lib/auth/access-policy.ts', {}, { Set });
  const result = { serviceOk: (data) => ({ ok: true, data }), serviceError: (status, code, message) => ({ ok: false, error: { status, code, message } }) };
  const observed = { writes: 0 };
  const deps = {
    'next/server': { NextResponse: { json: (body, init = {}) => ({ status: init.status || 200, body, headers: new Headers() }) } },
    '@/lib/services/shared/request-logging': { withRequestLogging: (fn) => fn },
    '@/lib/services/shared/request-auth': { authorizeBearerRequest: async (_req, permission) => !authenticated ? result.serviceError(401, 'missing_token', 'Sign in') : access.roleHasPermission(role, permission) ? result.serviceOk({ userId: 'doctor-1', role }) : result.serviceError(403, 'forbidden', 'No access') },
    '@/lib/services/shared/service-result': result,
    '@/lib/services/shared/http': { serviceResultToResponse: (value) => ({ status: value.ok ? 200 : value.error.status, body: value.ok ? value.data : value.error, headers: new Headers() }), unexpectedErrorResponse: () => ({ status: 500, headers: new Headers() }) },
    '@/lib/firebase-admin': { getFirebaseAdmin: () => ({}) },
    '@/lib/consultations/consultation-capabilities': { isConsultationCapabilityEnabled: () => enabled },
    '@/lib/appointments/appointment-policy': { ...policy(), parseAppointmentCommand: (body) => policy().parseAppointmentCommand(body, now) },
    '@/lib/services/appointments/appointment-service': { AppointmentService: class { async execute() { observed.writes++; return result.serviceOk({ appointment: {} }); } async list() { return result.serviceOk({ appointments: [], nextCursor: null }); } } },
    '@/lib/rate-limit': { enforceRateLimit: async () => null, RateLimitConfigs: { TOKEN_GENERATION: {} } },
    '@/lib/invitations/revoke-invitation': { revokeActiveInvitationsForRoom: async () => { observed.writes++; return 0; } },
  };
  const route = loadAppointmentModule('app/api/doctor/appointments/route.ts', deps, { Headers });
  return { observed, route, post: (body) => route.POST({ json: async () => body }), get: () => route.GET({ url: 'https://example.test/api/doctor/appointments' }) };
}

test('appointment endpoints deny unauthenticated, patient and administrative identities', async () => {
  for (const options of [{ authenticated: false }, { role: 'patient' }, { role: 'admin' }]) {
    const h = appointmentRoute(options);
    assert.equal(typeof h.route.POST, 'function');
    assert.equal((await h.post(create)).status, options.authenticated === false ? 401 : 403);
    assert.equal((await h.get()).status, options.authenticated === false ? 401 : 403);
    assert.equal(h.observed.writes, 0);
  }
});

test('scheduling remains disabled by default and invalid/null commands cause no writes', async () => {
  const disabled = appointmentRoute({ enabled: false });
  assert.equal(typeof disabled.route.POST, 'function');
  assert.equal((await disabled.post(create)).status, 503);
  assert.equal(disabled.observed.writes, 0);
  const enabled = appointmentRoute();
  for (const body of [null, {}, { ...create, doctorUserId: 'other-doctor' }]) assert.equal((await enabled.post(body)).status, 400);
  assert.equal(enabled.observed.writes, 0);
  const response = await enabled.post(create);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await enabled.route.POST({ json: async () => { throw new SyntaxError('Malformed JSON'); } })).status, 400);
});

test('private workspace capability never exposes scheduling to an administrator', async () => {
  for (const administrator of [false, true]) {
    const record = loadAppointmentModule('app/api/account/access/route.ts', {
      'next/server': { NextResponse: { json: (body) => ({ body }) } },
      '@/lib/services/shared/request-auth': { authenticateBearerToken: async () => ({ ok: true, data: { userId: 'staff', claimedRole: 'doctor', isAdminClaim: administrator, emailVerified: true } }) },
      '@/lib/services/shared/http': {},
      '@/lib/firebase-admin': {},
      '@/lib/auth/role-administration': loadAppointmentModule('lib/auth/role-administration.ts', {}, { Set }),
      '@/lib/consultations/consultation-capabilities': { isConsultationCapabilityEnabled: () => true },
      '@/lib/services/shared/request-logging': { withRequestLogging: (fn) => fn },
    }, { process: { env: {} } });
    const response = await record.GET({});
    assert.equal(response.body.schedulingEnabled, !administrator);
  }
});

test('prepare-invitation handoff derives a PII-free room from the booking id and rejects other query values', () => {
  const { appointmentRoomName, parseInvitationRoomHandoff } = loadAppointmentModule('lib/appointments/appointment-policy.ts', {}, { URLSearchParams });
  const room = appointmentRoomName(create.id);
  assert.equal(room, 'visit-111111111111');
  assert.match(room, /^[a-zA-Z0-9-_]{3,50}$/, 'must satisfy the invitation room-name validator');
  assert.ok(!room.includes('Synthetic') && !room.includes('@'));
  assert.equal(parseInvitationRoomHandoff(`?room=${room}`), room);
  assert.equal(parseInvitationRoomHandoff('?room=Kia'), null);
  assert.equal(parseInvitationRoomHandoff('?room=visit-111111111111%3Cscript%3E'), null);
  assert.equal(parseInvitationRoomHandoff(''), null);
});

test('cancellation carries a coded reason (default other) and rejects free text', () => {
  const { parseAppointmentCommand } = policy();
  const base = { action: 'cancel', id: create.id, expectedVersion: 2 };
  assert.equal(parseAppointmentCommand(base, now).data.cancellationReason, 'other');
  assert.equal(parseAppointmentCommand({ ...base, cancellationReason: 'patient-request' }, now).data.cancellationReason, 'patient-request');
  assert.equal(parseAppointmentCommand({ ...base, cancellationReason: 'patient has a toothache' }, now).ok, false);
});

test('cancelling an appointment revokes the visit room invitations through the shared revocation owner', () => {
  const route = readFileSync('app/api/doctor/appointments/route.ts', 'utf8');
  assert.match(route, /revokeActiveInvitationsForRoom\(db, auth\.data\.userId, appointmentRoomName\(command\.data\.id\)\)/);
  const revoke = readFileSync('lib/invitations/revoke-invitation.ts', 'utf8');
  assert.match(revoke, /where\('createdBy', '==', doctorUserId\)[\s\S]*where\('roomName', '==', roomName\)[\s\S]*where\('status', '==', 'active'\)[\s\S]*limit\(MAX_CASCADE_REVOCATIONS\)/);
  assert.match(readFileSync('app/api/invite/revoke/route.ts', 'utf8'), /revokeInvitation\(db, invitationId, auth\.data\.userId\)/);
  const service = readFileSync('lib/services/appointments/appointment-service.ts', 'utf8');
  assert.match(service, /byUserId: doctorUserId, reason: command\.cancellationReason/);
});

/** Real local transaction checks. Refuses a production or implicit database target. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8189');
assert.ok(existsSync('lib/services/appointments/appointment-service.ts'), 'Appointment service is not implemented');
const require = createRequire(import.meta.url);
const { initializeApp } = require('firebase-admin/app');
const firestore = require('firebase-admin/firestore');
const db = firestore.getFirestore(initializeApp({ projectId: 'demo-teleconsole-admin' }));
function compiled(path, deps = {}) {
  const record = { exports: {} };
  new Function('module', 'exports', 'require', ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(record, record.exports, (name) => { assert.ok(name in deps, name); return deps[name]; });
  return record.exports;
}
const policy = compiled('lib/appointments/appointment-policy.ts');
const results = compiled('lib/services/shared/service-result.ts');
const { AppointmentService } = compiled('lib/services/appointments/appointment-service.ts', {
  'firebase-admin/firestore': firestore,
  '@/lib/appointments/appointment-policy': policy,
  '../shared/service-result': results,
});
const now = new Date('2026-11-27T00:00:00Z');
const service = new AppointmentService(db, () => now);
const uid = `synthetic-calendar-${randomUUID()}`;
const secondUid = `synthetic-calendar-${randomUUID()}`;
function booking(localStart = '2026-11-28T09:00', extra = {}) {
  const value = policy.parseAppointmentCommand({ action: 'create', id: randomUUID(), patientName: 'Synthetic patient', patientEmail: 'patient@example.test', localStart, durationMinutes: 30, displayTimeZone: 'Asia/Manila', ...extra }, now);
  assert.equal(value.ok, true);
  return value.data;
}
const before = {};
for (const name of ['invitations', 'consultationSessions', 'summaryJobs']) before[name] = (await db.collection(name).get()).size;
const first = booking();
const competing = booking();
const race = await Promise.all([service.execute(uid, first), service.execute(uid, competing)]);
assert.equal(race.filter((r) => r.ok).length, 1, 'One overlapping booking wins');
assert.equal(race.filter((r) => !r.ok && r.error.code === 'appointment_overlap').length, 1);
const winner = race[0].ok ? first : competing;
const replay = await service.execute(uid, winner);
assert.equal(replay.ok, true);
assert.equal(replay.data.appointment.version, 1);
assert.equal((await db.collection('appointments').where('doctorUserId', '==', uid).get()).size, 1, 'Retry creates no duplicate');
assert.equal((await service.execute(secondUid, winner)).error.status, 403);
assert.equal((await service.execute(secondUid, booking())).ok, true, 'Different doctors may book at the same time');
const adjacent = booking('2026-11-28T09:30');
assert.equal((await service.execute(uid, adjacent)).ok, true);
const reschedule = booking('2026-11-28T09:30', { action: 'reschedule', id: winner.id, expectedVersion: 1 });
assert.equal((await service.execute(uid, reschedule)).error.code, 'appointment_overlap');
assert.equal((await service.execute(uid, { ...reschedule, startsAt: '2026-11-28T03:00:00.000Z', endsAt: '2026-11-28T03:30:00.000Z', expectedVersion: 99 })).error.status, 409);
const moved = await service.execute(uid, { ...reschedule, startsAt: '2026-11-28T02:00:00.000Z', endsAt: '2026-11-28T02:30:00.000Z' });
assert.equal(moved.ok, true);
assert.equal(moved.data.appointment.version, 2);
assert.equal((await service.execute(uid, { action: 'cancel', id: adjacent.id, expectedVersion: 1 })).data.appointment.status, 'cancelled');
assert.equal((await service.execute(uid, booking('2026-11-28T09:30'))).ok, true, 'Cancellation releases only its interval');
assert.equal((await service.execute(uid, { ...adjacent, action: 'reschedule', expectedVersion: 2 })).error.status, 409);
const pageUid = `synthetic-paged-${randomUUID()}`;
for (let n = 0; n < 55; n++) {
  const start = new Date(Date.UTC(2026, 10, 29, 0, n * 30));
  assert.equal((await service.execute(pageUid, booking(start.toISOString().slice(0, 16), { displayTimeZone: 'UTC' }))).ok, true);
}
const page1 = await service.list(pageUid);
assert.equal(page1.data.appointments.length, 50);
assert.ok(page1.data.nextCursor);
const page2 = await service.list(pageUid, page1.data.nextCursor);
assert.equal(page2.data.appointments.length, 5);
assert.equal(page2.data.nextCursor, null);
assert.equal(new Set([...page1.data.appointments, ...page2.data.appointments].map((r) => r.id)).size, 55);
assert.equal((await service.list(uid, 'invalid')).error.status, 400);
for (const name of Object.keys(before)) assert.equal((await db.collection(name).get()).size, before[name], 'Booking has no clinical or invitation side effect');
const report = { date: '2026-11-27', environment: 'Local Firestore emulator, synthetic records, Node22', concurrentOverlap: 'one accepted, one refused', replayNoDuplicate: true, crossDoctorDenied: true, distinctDoctorIndependent: true, adjacentAllowed: true, staleVersionDenied: true, rescheduleConflictDenied: true, cancelReleasesSlot: true, pagination: [50,5], noClinicalSideEffects: true, productionAcceptance: false };
mkdirSync('tmp/appointments', { recursive: true });
writeFileSync('tmp/appointments/emulator.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
process.exit(0);

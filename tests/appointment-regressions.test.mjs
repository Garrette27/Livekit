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
  for (const value of [null, [], {}, { ...create, id: '../other' }, { ...create, patientName: '' }, { ...create, patientName: 'x'.repeat(101) }, { ...create, patientEmail: 'not-an-email' }, { ...create, durationMinutes: 14 }, { ...create, durationMinutes: 121 }, { ...create, durationMinutes: NaN }, { ...create, localStart: '2026-02-30T10:00' }, { ...create, localStart: '2026-11-26T10:00' }, { ...create, localStart: '2028-01-01T10:00' }, { ...create, displayTimeZone: 'imaginary/zone' }]) {
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

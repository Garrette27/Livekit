import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadAppointmentModule as loadModule } from './appointment-regressions.test.mjs';

const service = () => loadModule('lib/services/admin/invitation-activity-service.ts', { crypto }, { Map, Array, Number, String, Math });
const now = new Date('2026-11-28T09:00:00Z');
// Synthetic records only.
const invitations = [
  { id: 'invite_old', data: { createdAt: new Date('2026-11-27T01:00:00Z'), expiresAt: new Date('2026-11-28T01:00:00Z'), status: 'active', waitingRoomEnabled: true, roomName: 'visit-x', metadata: { doctorName: 'Dr. Synthetic', doctorEmail: 'doctor@example.test', constraints: { emailHashes: ['h1'] } } } },
  { id: 'invite_new', data: { createdAt: new Date('2026-11-28T06:55:00Z'), expiresAt: new Date('2026-11-29T06:55:00Z'), status: 'active', waitingRoomEnabled: true, metadata: { doctorName: 'Dr. System', doctorEmail: 'system@example.com' } } },
  { id: 'invite_revoked', data: { createdAt: new Date('2026-11-26T01:00:00Z'), expiresAt: new Date('2026-11-30T01:00:00Z'), status: 'revoked', metadata: {} } },
];
const rows = [
  { id: 'row-direct', data: { invitationId: 'invite_new', status: 'admitted', joinedAt: new Date('2026-11-28T07:00:00Z'), admittedAt: new Date('2026-11-28T07:00:00Z'), patientName: 'Synthetic Patient', patientEmail: 'patient@example.test', metadata: { admissionMode: 'auto-email-match', isAnonymous: false, networkHash: 'n', userAgentHash: 'u' } } },
  { id: 'row-guest', data: { invitationId: 'invite_new', status: 'rejected', joinedAt: new Date('2026-11-28T07:05:00Z'), patientName: 'Typed Name', metadata: { admissionMode: 'doctor-manual', isAnonymous: true } } },
  { id: 'row-account', data: { invitationId: 'invite_new', status: 'waiting', joinedAt: new Date('2026-11-28T07:10:00Z'), metadata: { admissionMode: 'doctor-manual', isAnonymous: false } } },
];

test('invitations list newest first with the creating doctor and lifecycle', () => {
  const result = service().projectInvitationActivity(invitations, rows, now);
  assert.deepEqual(JSON.parse(JSON.stringify(result.map((row) => row.lifecycle))), ['active', 'expired', 'revoked']);
  assert.equal(result[1].doctor.name, 'Dr. Synthetic');
  assert.equal(result[1].doctor.email, 'doctor@example.test');
  assert.equal(result[0].doctor.name, 'Unnamed doctor', 'the legacy placeholder name is not shown as a person');
  assert.equal(result[0].doctor.email, null);
  assert.equal(result[0].usage, 'reusable until expiry');
});

test('visits say how each patient arrived and whether the doctor admitted them', () => {
  const [newest] = service().projectInvitationActivity(invitations, rows, now);
  assert.deepEqual(JSON.parse(JSON.stringify(newest.visits)), { total: 3, waiting: 1, admitted: 1, left: 0, rejected: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(newest.arrivals.map((arrival) => [arrival.visitor, arrival.admission, arrival.status]))), [
    ['Signed-in account', 'not admitted', 'waiting'],
    ['Guest (typed name)', 'not admitted', 'rejected'],
    ['Verified invited account', 'joined directly', 'admitted'],
  ]);
  assert.match(newest.arrivals[0].visitorRef, /^[0-9a-f]{6}$/);
});

test('administrators never receive patient names, emails, ids, hashes, room names or allowlists', () => {
  const json = JSON.stringify(service().projectInvitationActivity(invitations, rows, now));
  for (const secret of ['Synthetic Patient', 'Typed Name', 'patient@example.test', 'row-direct', 'invite_new', 'networkHash', 'visit-x', 'emailHashes', '"h1"']) {
    assert.ok(!json.includes(secret), `leaked ${secret}`);
  }
});

test('the activity route is administrator-only and scoped by server authority', () => {
  const route = readFileSync('app/api/admin/invitation-activity/route.ts', 'utf8');
  assert.match(route, /administratorLevel\(caller\.data/);
  assert.match(route, /status: 403/);
  assert.match(route, /clinicId: caller\.data\.clinicId \?\? null/);
  const source = readFileSync('lib/services/admin/invitation-activity-service.ts', 'utf8');
  assert.match(source, /where\('role', '==', 'doctor'\)\.where\('clinicId', '==', scope\.clinicId\)/);
  assert.match(source, /if \(!scope\.clinicId\) return/);
  const page = readFileSync('app/admin/page.tsx', 'utf8');
  assert.match(page, /<InvitationActivityPanel \/>/);
});

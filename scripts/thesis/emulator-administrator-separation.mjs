/** Exercise direct client rules locally; never connects to a production project. */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const host = process.env.FIRESTORE_EMULATOR_HOST;
assert.equal(host, '127.0.0.1:8189', 'Use the dedicated local emulator on port 8189');
const project = 'demo-teleconsole-admin';
const origin = `http://${host}`;
const documents = `${origin}/v1/projects/${project}/databases/(default)/documents`;
const currentRules = readFileSync('firestore.rules', 'utf8');
const baselineRules = execFileSync('git', ['show', 'HEAD:firestore.rules'], { encoding: 'utf8' });
async function rules(content) {
  const response = await fetch(`${origin}/emulator/v1/projects/${project}:securityRules`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content }] } }),
  });
  assert.equal(response.status, 200, await response.text());
}
function credential(uid, claims) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ iss: `https://securetoken.google.com/${project}`, aud: project, sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: 'custom' }, ...claims })}.`;
}
const kinds = [
  ['doctor', { role: 'doctor' }, true],
  ['combined-admin', { role: 'doctor', admin: true }, false],
  ['admin', { role: 'admin', admin: true }, false],
  ['patient', { role: 'patient' }, false],
];
for (const [uid] of kinds) {
  const response = await fetch(`${documents}/invitations/${uid}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { createdBy: { stringValue: uid } } }) });
  assert.equal(response.status, 200);
}
async function readInvitation(uid, claims) {
  return fetch(`${documents}/invitations/${uid}`, { headers: { Authorization: `Bearer ${credential(uid, claims)}` } });
}
try {
  await rules(baselineRules);
  assert.equal((await readInvitation('combined-admin', { role: 'doctor', admin: true })).status, 200, 'Baseline reproduces combined-admin clinical read');
  await rules(currentRules);
  const results = [];
  for (const [uid, claims, clinician] of kinds) {
    const read = await readInvitation(uid, claims);
    // Patients may retain own consultation reads, but not a doctor invitation workbench.
    const expectedRead = clinician ? 200 : 403;
    assert.equal(read.status, expectedRead, uid);
    const create = await fetch(`${documents}/rooms/${uid}`, { method: 'PATCH', headers: { Authorization: `Bearer ${credential(uid, claims)}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { roomName: { stringValue: 'synthetic-room' }, createdBy: { stringValue: uid }, createdAt: { timestampValue: new Date().toISOString() }, status: { stringValue: 'active' } } }) });
    assert.equal(create.status, clinician ? 200 : 403, uid);
    results.push({ identity: uid, ownInvitationRead: read.status, createClinicalRoom: create.status });
  }
  const stranger = await fetch(`${documents}/invitations/doctor`, { headers: { Authorization: `Bearer ${credential('stranger', { role: 'doctor' })}` } });
  assert.equal(stranger.status, 403);
  const unauthenticated = await fetch(`${documents}/invitations/doctor`);
  assert.equal(unauthenticated.status, 403);
  const report = { date: '2026-11-27', environment: 'Local Firestore emulator, synthetic documents only', baselineCombinedAdminReadReproduced: true, currentRulesCompiled: true, results, unrelatedDoctorDenied: true, unauthenticatedDenied: true, productionRulesDeployed: false };
  mkdirSync('tmp/admin-separation', { recursive: true });
  writeFileSync('tmp/admin-separation/emulator-rules.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await rules(currentRules); }

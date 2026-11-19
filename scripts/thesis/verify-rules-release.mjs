import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

/** Verify the released source and safe public denial responses without production attack writes. */
const dir = 'docs/testing/evidence/2026-11-19-rules-release';
const active = JSON.parse(readFileSync(`${dir}/deployed-firestore-rules.json`, 'utf8')).source;
const normalize = value => value.replace(/\r/g, '').trim();
const same = normalize(active) === normalize(readFileSync('firestore.rules', 'utf8'));
if (!same) throw Error('Active policy does not match reviewed source');
const hash = text => createHash('sha256').update(text).digest('hex');
const report = { testedAt: new Date().toISOString(), activeRulesMatch: same,
  activeNormalizedSha256: hash(normalize(active)), productionAttackWrites: false, probes: [] };
for (const [path, method] of [
  ['/api/doctor-access', 'POST'], ['/api/user/role-conflict', 'POST'],
  ['/api/patient/consultations', 'GET'], ['/api/waiting-room/list', 'GET'],
]) {
  const response = await fetch(`https://livekit-frontend-tau.vercel.app${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: '{}' } : {}), redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });
  const json = response.headers.get('content-type')?.includes('application/json') === true;
  await response.arrayBuffer();
  report.probes.push({ path, method, status: response.status, json,
    pass: response.status === 401 && json });
}
// The retrieved active source is byte-normalized equal to the candidate tested
// by the maintained emulator suite. No hostile writes target the real project.
const result = spawnSync('npx', ['-y', 'firebase-tools@15.36.0', 'emulators:exec',
  '--only', 'firestore,storage', '--project', 'demo-livekit-security', '--config',
  'firebase.json', 'npm --prefix functions run test:rules'], {
  encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024,
});
writeFileSync(`${dir}/active-equivalent-rules-test.log`, (result.stdout || '') + (result.stderr || ''));
report.emulatorExitCode = result.status;
report.scope = 'Released-source match, equivalent-source emulator tests and anonymous API denials; not authenticated production journey or media acceptance';
writeFileSync(`${dir}/acceptance.json`, JSON.stringify(report, null, 2));
writeFileSync(`${dir}/sha256.json`, JSON.stringify(Object.fromEntries(readdirSync(dir)
  .filter(name => name !== 'sha256.json').sort().map(name => [name, hash(readFileSync(`${dir}/${name}`))])), null, 2));
console.log(report);
process.exitCode = result.status === 0 && report.probes.every(probe => probe.pass) ? 0 : 1;

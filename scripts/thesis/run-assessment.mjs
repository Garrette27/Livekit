import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir, platform, release, cpus } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

/** Record reproducible evidence without recording credentials or response bodies. */
const output = resolve(process.env.THESIS_OUTPUT || 'docs/testing/evidence/2026-11-17');
mkdirSync(output, { recursive: true });
const save = (name, value) => writeFileSync(resolve(output, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
const git = (...args) => spawnSync('git', args, { encoding: 'utf8' }).stdout.trim();
const evidence = { startedAt: new Date().toISOString(), commit: git('rev-parse', 'HEAD'), dirtyPaths: git('status', '--short').split('\n'), node: process.version, platform: platform(), os: release(), cpu: cpus()[0]?.model, checks: [] };
for (const [id, args] of [['POLICY', ['run', 'test:security']], ['TYPES', ['run', 'typecheck']], ['LINT', ['run', 'lint']]]) {
  const started = performance.now();
  const result = spawnSync('npm', args, { encoding: 'utf8', timeout: 180_000 });
  save(`${id.toLowerCase()}.log`, (result.stdout || '') + (result.stderr || ''));
  evidence.checks.push({ id, exitCode: result.status, durationMs: Math.round(performance.now() - started), status: result.status === 0 ? 'PASS' : 'FAIL' });
}
// Audit the committed lockfile separately from the user's installed/dirty tree.
const auditDir = mkdtempSync(resolve(tmpdir(), 'teleconsole-audit-'));
for (const file of ['package.json', 'package-lock.json']) writeFileSync(resolve(auditDir, file), spawnSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' }).stdout);
const audit = spawnSync('npm', ['audit', '--omit=dev', '--package-lock-only', '--json'], { cwd: auditDir, encoding: 'utf8', timeout: 120_000 });
try {
  const report = JSON.parse(audit.stdout);
  save('dependency-audit.json', report);
  evidence.dependencies = { source: 'committed HEAD package-lock.json', exitCode: audit.status, counts: report.metadata?.vulnerabilities, packages: Object.values(report.vulnerabilities || {}).map((v) => ({ name: v.name, severity: v.severity, direct: v.isDirect, range: v.range, advisories: v.via.filter((x) => typeof x === 'object').map((x) => ({ title: x.title, url: x.url })) })) };
} catch { evidence.dependencies = { status: 'BLOCKED', exitCode: audit.status }; }

const base = new URL(process.env.THESIS_BASE_URL || 'https://livekit-frontend-tau.vercel.app');
if (!['livekit-frontend-tau.vercel.app', '127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('Use the documented thesis target or localhost.');
const routes = [
  ['GET', '/api/doctor/history'], ['GET', '/api/patient/consultations'], ['GET', '/api/patient/pending-waiting-room'],
  ['GET', '/api/summary/process-queue'], ['GET', '/api/invite/get-link?roomName=thesis-synthetic'], ['GET', '/api/waiting-room/list'],
  ['POST', '/api/doctor-access'], ['POST', '/api/invite/create'], ['POST', '/api/invite/revoke'],
  ['POST', '/api/link-patient-consultations'], ['POST', '/api/patient/consent'], ['POST', '/api/summary/generate'], ['POST', '/api/token'],
  ['POST', '/api/track-consultation'], ['POST', '/api/track-doctor-presence'], ['POST', '/api/user/role-conflict'],
  ['POST', '/api/waiting-room/admit'], ['POST', '/api/waiting-room/check-admission'], ['POST', '/api/waiting-room/mark-left'], ['POST', '/api/waiting-room/reject'],
];
evidence.target = base.origin;
evidence.api = [];
for (const [method, path] of routes) {
  const started = performance.now();
  try {
    const response = await fetch(new URL(path, base), { method, redirect: 'manual', signal: AbortSignal.timeout(20_000), ...(method === 'POST' ? { headers: { 'content-type': 'application/json' }, body: '{}' } : {}) });
    const body = await response.json().catch(() => null);
    evidence.api.push({ method, path, statusCode: response.status, successFalse: body?.success === false, durationMs: Math.round(performance.now() - started), status: response.status === 401 && body?.success === false ? 'PASS' : 'FAIL' });
  } catch (error) { evidence.api.push({ method, path, status: 'BLOCKED', errorType: error.name }); }
  await new Promise((done) => setTimeout(done, 250));
}
evidence.pages = [];
for (const path of ['/', '/access-denied?reason=invalid-token']) {
  const samples = [];
  for (let trial = 1; trial <= 10; trial++) {
    const start = performance.now();
    try {
      const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20_000), redirect: 'manual' });
      const headersMs = performance.now() - start;
      const body = await response.arrayBuffer();
      const selectedHeaders = Object.fromEntries(['content-security-policy', 'x-frame-options', 'x-content-type-options', 'strict-transport-security', 'referrer-policy', 'cache-control', 'x-vercel-cache'].map((key) => [key, response.headers.get(key)]));
      samples.push({ trial, statusCode: response.status, headersMs: Math.round(headersMs), totalMs: Math.round(performance.now() - start), bytes: body.byteLength, headers: selectedHeaders });
    } catch (error) { samples.push({ trial, errorType: error.name }); }
    await new Promise((done) => setTimeout(done, 250));
  }
  const times = samples.filter((s) => s.totalMs !== undefined).map((s) => s.totalMs).sort((a, b) => a - b);
  evidence.pages.push({ path, samples, n: times.length, medianMs: times.length ? (times[4] + times[5]) / 2 : null, p95Ms: times.length ? times[Math.ceil(times.length * 0.95) - 1] : null, meanMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null, criterion: 'Exploratory HTTP body response p95 <= 3000 ms and all ten status 200; this is not browser LCP or media latency', status: times.length === 10 && times[9] <= 3000 && samples.every((s) => s.statusCode === 200) ? 'PASS' : 'FAIL' });
}
evidence.finishedAt = new Date().toISOString();
save('assessment.json', evidence);
const files = ['assessment.json', 'dependency-audit.json', 'policy.log', 'types.log', 'lint.log'];
save('sha256.json', Object.fromEntries(files.map((file) => [file, createHash('sha256').update(readFileSync(resolve(output, file))).digest('hex')])));
console.log(JSON.stringify({ output, commit: evidence.commit, checks: evidence.checks, dependencies: evidence.dependencies?.counts, apiPass: evidence.api.filter((x) => x.status === 'PASS').length, apiTotal: evidence.api.length, pages: evidence.pages.map(p => ({path:p.path,n:p.n,medianMs:p.medianMs,p95Ms:p.p95Ms,status:p.status})) }, null, 2));

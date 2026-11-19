import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

/** Publish only the explicitly approved, committed Firestore policy; never data or other services. */
const dir = 'docs/testing/evidence/2026-11-19-rules-release';
const git = args => spawnSync('git', args, { encoding: 'utf8' });
if (git(['diff', 'HEAD', '--', 'firestore.rules']).stdout.trim()) throw Error('Rules differ from reviewed commit');
mkdirSync(dir, { recursive: true });
const report = {
  startedAt: new Date().toISOString(), commit: git(['rev-parse', 'HEAD']).stdout.trim(),
  project: 'livekit-5eef6', scope: 'firestore:rules',
  rulesSha256: createHash('sha256').update(readFileSync('firestore.rules')).digest('hex'),
};
const result = spawnSync('npx', ['-y', 'firebase-tools@15.36.0', 'deploy', '--only', 'firestore:rules', '--project', report.project, '--non-interactive'], {
  encoding: 'utf8', timeout: 180000, maxBuffer: 2 * 1024 * 1024,
});
writeFileSync(`${dir}/deploy.log`, (result.stdout || '') + (result.stderr || ''));
Object.assign(report, { exitCode: result.status, finishedAt: new Date().toISOString() });
writeFileSync(`${dir}/release.json`, JSON.stringify(report, null, 2));
console.log(report);
process.exitCode = result.status === 0 ? 0 : 1;

/** Reproduce a queue-capacity boundary using real source and synthetic IO only. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const sourcePath = 'lib/invitations/validate-service.ts';
const reservationPath = 'lib/invitations/invitation-use-reservation.ts';
const source = readFileSync(sourcePath, 'utf8');
const ast = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true);
const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'validateUsageLimits');
assert.ok(fn, 'Locate the actual capacity pre-check');
const exports = {};
runInNewContext(ts.transpileModule(`export ${fn.getText(ast)}`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports, result: (status, body) => ({ status, body }),
});
const record = { exports: {} };
runInNewContext(ts.transpileModule(readFileSync(reservationPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  module: record, exports: record.exports, Date,
});
const waiting = new Map(Array.from({ length: 9 }, (_, i) => [`old-${i}`, { status: 'waiting' }]));
let invitation = { status: 'active', expiresAt: new Date(Date.now() + 3600000), maxPatients: 10, currentUses: 0, maxUses: 999999 };
let serial = Promise.resolve(), nextId = 0;
const query = { query: true, where() { return this; }, orderBy() { return this; }, offset() { return this; }, limit() { return this; }, async get() { return { size: waiting.size, docs: [] }; } };
const ref = path => ({ path, collection: name => collection(`${path}/${name}`) });
const collection = path => ({ ...query, doc: id => ref(`${path}/${id || `auto-${nextId++}`}`) });
const db = { collection, runTransaction(callback) {
  const operation = serial.then(() => callback({
    async get(target) {
      if (target.query) return { docs: [] };
      if (target.path === 'invitations/synthetic-invite') return { exists: true, data: () => invitation };
      return { exists: false };
    },
    update(target, value) { if (target.path === 'invitations/synthetic-invite') invitation = { ...invitation, ...value }; },
    set(target, value) { if (/^waitingPatients\/[^/]+$/.test(target.path)) waiting.set(target.path, value); },
    delete() {},
  }));
  serial = operation.catch(() => {});
  return operation;
} };
// Both distinct visitors pass the real pre-check before either reservation.
const prechecks = await Promise.all([0, 1].map(() => exports.validateUsageLimits(db, invitation, 'synthetic-invite', 'synthetic-room', true)));
assert.deepEqual(prechecks, [null, null]);
const reserved = await Promise.all([0, 1].map(i => record.exports.reserveInvitationUse(db, 'synthetic-invite', { timestamp: new Date() }, {
  waitingPatient: { id: `new-${i}`, onCreate: { joinedAt: new Date() }, onEachVisit: { status: 'waiting' } },
})));
assert.ok(reserved.every(Boolean));
assert.equal(waiting.size, 11, 'The existing reservation does not atomically enforce maxPatients');
assert.equal(invitation.currentUses, 2, 'Use counting itself remains transactional');
const report = {
  date: '2026-11-25', environment: 'local Node 22, actual source with synthetic transaction/query adapters',
  source_baseline: '9d53610855737c13914a86c02ee33a58b31cd15c',
  source_sha256: Object.fromEntries([sourcePath, reservationPath].map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])),
  fixture: { initial_waiting: 9, configured_target: 10, distinct_arrivals: 2 },
  observed: { prechecks_allowed: 2, successful_reservations: 2, final_waiting: waiting.size, invitation_use_increment: invitation.currentUses },
  claim_status: 'Hard atomic maxPatients guarantee NOT PASSED; configured target may overshoot under concurrent arrivals',
  authority: 'Documentation audit only; no app fix, production data, real network throughput or cloud load',
};
const output = 'docs/thesis-defense/evidence/queue-title-2026-11-25/source-audit.json';
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

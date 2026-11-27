/**
 * Concurrency check of reserveWaitingVisit against the Firestore emulator's
 * real transaction engine (synthetic ids only). Run with:
 *   firebase emulators:exec --only firestore --project demo-teleconsole "node scripts/thesis/emulator-queue-capacity.mjs"
 * The emulator is local; it is evidence of transaction semantics, not of
 * production latency or cloud throughput.
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import ts from 'typescript';

assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Refusing to run outside the Firestore emulator');
const require = createRequire(import.meta.url);
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore(initializeApp({ projectId: 'demo-teleconsole' }));

// Compile in this realm: Firestore checks `instanceof Promise`, which a vm
// context's Promise would fail.
const record = { exports: {} };
new Function('module', 'exports', ts.transpileModule(readFileSync('lib/invitations/invitation-use-reservation.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(record, record.exports);
const { reserveWaitingVisit } = record.exports;

const arrive = (invitationId, i) => reserveWaitingVisit(db, invitationId, { synthetic: true, timestamp: new Date() }, {
  id: `${invitationId}-new-${i}`, roomName: 'synthetic-room', status: 'waiting', newVisitId: `visit-${i}`,
  onNewVisit: { invitationId }, onEachVisit: { roomName: 'synthetic-room', invitationId },
}).catch(() => ({ outcome: 'error' }));

async function seed(label, { initialWaiting, maxPatients }) {
  const invitationId = `synthetic-${label}-${Date.now()}`;
  await db.collection('invitations').doc(invitationId).set({
    status: 'active', expiresAt: new Date(Date.now() + 3600000), maxPatients, currentUses: 0, maxUses: 999999,
  });
  await Promise.all(Array.from({ length: initialWaiting }, (_, i) => db.collection('waitingPatients').doc(`${invitationId}-old-${i}`)
    .set({ status: 'waiting', roomName: 'synthetic-room', invitationId })));
  return invitationId;
}

const countWaiting = async (invitationId) =>
  (await db.collection('waitingPatients').where('invitationId', '==', invitationId).where('status', '==', 'waiting').get()).size;

async function trial(label, { initialWaiting, maxPatients, arrivals }) {
  const invitationId = await seed(label, { initialWaiting, maxPatients });
  const started = performance.now();
  const outcomes = await Promise.all(Array.from({ length: arrivals }, (_, i) => arrive(invitationId, i)));
  const wallMs = Math.round(performance.now() - started);
  const uses = (await db.collection('invitations').doc(invitationId).get()).data().currentUses;
  return {
    initialWaiting, maxPatients, concurrentArrivals: arrivals,
    reserved: outcomes.filter(o => o.outcome === 'reserved').length,
    refusedFull: outcomes.filter(o => o.outcome === 'full').length,
    contentionErrors: outcomes.filter(o => o.outcome === 'error').length,
    finalWaiting: await countWaiting(invitationId), invitationUses: uses, wallClockMs: wallMs,
  };
}

// Arrivals in waves of 10 simultaneous visitors (a busier but realistic link).
async function waves(label, { maxPatients, waveSize, waveCount }) {
  const invitationId = await seed(label, { initialWaiting: 0, maxPatients });
  const outcomes = [];
  const started = performance.now();
  for (let w = 0; w < waveCount; w++) {
    outcomes.push(...await Promise.all(Array.from({ length: waveSize }, (_, i) => arrive(invitationId, w * waveSize + i))));
  }
  return {
    initialWaiting: 0, maxPatients, concurrentArrivals: waveSize, waves: waveCount,
    reserved: outcomes.filter(o => o.outcome === 'reserved').length,
    refusedFull: outcomes.filter(o => o.outcome === 'full').length,
    contentionErrors: outcomes.filter(o => o.outcome === 'error').length,
    finalWaiting: await countWaiting(invitationId),
    invitationUses: (await db.collection('invitations').doc(invitationId).get()).data().currentUses,
    wallClockMs: Math.round(performance.now() - started),
  };
}

// Doctor edits the limit on a live invitation: 2 -> 3 (raise), then 3 -> 2 (lower).
async function limitChange() {
  const invitationId = await seed('limit', { initialWaiting: 0, maxPatients: 2 });
  const ref = db.collection('invitations').doc(invitationId);
  const atTwo = await Promise.all([0, 1, 2].map(i => arrive(invitationId, i)));
  await ref.update({ maxPatients: 3 });
  const afterRaise = await arrive(invitationId, 3);
  await ref.update({ maxPatients: 2 });
  const afterLower = await arrive(invitationId, 4);
  return {
    limit2_three_arrivals: atTwo.map(o => o.outcome),
    raised_to_3_next_arrival: afterRaise.outcome,
    lowered_to_2_next_arrival: afterLower.outcome,
    waiting_after_lowering: await countWaiting(invitationId),
  };
}

const results = {
  pair_at_9_of_10: await trial('pair', { initialWaiting: 9, maxPatients: 10, arrivals: 2 }),
  burst_25_into_10: await trial('burst', { initialWaiting: 0, maxPatients: 10, arrivals: 25 }),
  burst_150_into_100_maximum: await trial('max', { initialWaiting: 0, maxPatients: 100, arrivals: 150 }),
  waves_12x10_into_100_maximum: await waves('waves', { maxPatients: 100, waveSize: 10, waveCount: 12 }),
};
for (const r of Object.values(results)) {
  assert.ok(r.finalWaiting <= r.maxPatients, `overshoot: ${JSON.stringify(r)}`);
  assert.equal(r.finalWaiting, r.initialWaiting + r.reserved, 'Every reserved arrival has exactly one waiting row');
  assert.equal(r.invitationUses, r.reserved, 'Refused arrivals consume no use');
}
const limit_change = await limitChange();
assert.deepEqual([...limit_change.limit2_three_arrivals].sort(), ['full', 'reserved', 'reserved']);
assert.equal(limit_change.raised_to_3_next_arrival, 'reserved');
assert.equal(limit_change.lowered_to_2_next_arrival, 'full');
assert.equal(limit_change.waiting_after_lowering, 3, 'Lowering the limit evicts nobody');
results.limit_change = limit_change;
const report = {
  run_at_utc: new Date().toISOString(),
  note: 'contentionErrors = arrivals whose transaction gave up after Firestore retries under extreme same-invitation contention; they hold no place and consume no use.',
  environment: `Firestore emulator (firebase-tools), Node ${process.version}, synthetic ids, single machine`,
  results,
  claim_status: 'Per-invitation waiting target held under concurrent transactions in the emulator. Not a production or cloud load measurement.',
};
const output = 'docs/thesis-defense/evidence/queue-capacity-fix-2026-11-27/emulator-capacity.json';
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exit(0);

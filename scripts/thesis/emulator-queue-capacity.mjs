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

async function trial(label, { initialWaiting, maxPatients, arrivals }) {
  const invitationId = `synthetic-${label}-${Date.now()}`;
  await db.collection('invitations').doc(invitationId).set({
    status: 'active', expiresAt: new Date(Date.now() + 3600000), maxPatients, currentUses: 0, maxUses: 999999,
  });
  await Promise.all(Array.from({ length: initialWaiting }, (_, i) => db.collection('waitingPatients').doc(`${invitationId}-old-${i}`)
    .set({ status: 'waiting', roomName: 'synthetic-room', invitationId })));
  const outcomes = await Promise.all(Array.from({ length: arrivals }, (_, i) => reserveWaitingVisit(db, invitationId, { synthetic: true, timestamp: new Date() }, {
    id: `${invitationId}-new-${i}`, roomName: 'synthetic-room', status: 'waiting', newVisitId: `visit-${i}`,
    onNewVisit: { invitationId }, onEachVisit: { roomName: 'synthetic-room', invitationId },
  })));
  const waiting = await db.collection('waitingPatients').where('invitationId', '==', invitationId).where('status', '==', 'waiting').get();
  const uses = (await db.collection('invitations').doc(invitationId).get()).data().currentUses;
  return {
    initialWaiting, maxPatients, concurrentArrivals: arrivals,
    reserved: outcomes.filter(o => o.outcome === 'reserved').length,
    refusedFull: outcomes.filter(o => o.outcome === 'full').length,
    finalWaiting: waiting.size, invitationUses: uses,
  };
}

const results = {
  pair_at_9_of_10: await trial('pair', { initialWaiting: 9, maxPatients: 10, arrivals: 2 }),
  burst_25_into_10: await trial('burst', { initialWaiting: 0, maxPatients: 10, arrivals: 25 }),
};
for (const r of Object.values(results)) {
  assert.ok(r.finalWaiting <= r.maxPatients, `overshoot: ${JSON.stringify(r)}`);
  assert.equal(r.finalWaiting, Math.min(r.maxPatients, r.initialWaiting + r.concurrentArrivals));
  assert.equal(r.invitationUses, r.reserved, 'Refused arrivals consume no use');
}
const report = {
  run_at_utc: new Date().toISOString(),
  environment: `Firestore emulator (firebase-tools), Node ${process.version}, synthetic ids, single machine`,
  results,
  claim_status: 'Per-invitation waiting target held under concurrent transactions in the emulator. Not a production or cloud load measurement.',
};
const output = 'docs/thesis-defense/evidence/queue-capacity-fix-2026-11-27/emulator-capacity.json';
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exit(0);

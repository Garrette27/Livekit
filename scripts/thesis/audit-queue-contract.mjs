/**
 * Queue-capacity and visit-binding audit using the real reservation source and
 * synthetic IO only (no Firebase, no network, no patient data).
 *
 * History: the 2026-11-25 run (evidence/queue-title-2026-11-25) showed the old
 * pre-check ran outside the reservation transaction, so 9 waiting + 2
 * concurrent arrivals ended at 11. This version exercises reserveWaitingVisit,
 * which counts waiting rows inside the transaction that also writes the
 * invitation document. Real Firestore serializes two transactions that write
 * the same document (one retries); the fake below models that by running
 * transactions one at a time.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const reservationPath = 'lib/invitations/invitation-use-reservation.ts';
const record = { exports: {} };
runInNewContext(ts.transpileModule(readFileSync(reservationPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: record, exports: record.exports, Date });
const { reserveWaitingVisit } = record.exports;

function fixture({ waitingRows = 9, maxPatients = 10 } = {}) {
  const rows = new Map(Array.from({ length: waitingRows }, (_, i) => [`waitingPatients/old-${i}`, { status: 'waiting', roomName: 'room-s', invitationId: 'invite-s' }]));
  let invitation = { status: 'active', expiresAt: new Date(Date.now() + 3600000), maxPatients, currentUses: 0, maxUses: 999999 };
  let serial = Promise.resolve();
  let nextId = 0;
  const query = (filters = []) => ({
    query: true, filters,
    where(field, _op, value) { return query([...filters, [field, value]]); },
    orderBy() { return this; }, offset() { return this; }, limit() { return this; },
  });
  const ref = path => ({ path, collection: name => collection(`${path}/${name}`) });
  const collection = path => ({ ...query(), doc: id => ref(`${path}/${id || `auto-${nextId++}`}`) });
  const db = {
    collection,
    runTransaction(callback) {
      const operation = serial.then(() => callback({
        async get(target) {
          if (target.query) {
            const docs = [...rows.values()].filter(row => target.filters.every(([field, value]) => row[field] === value));
            return { size: target.filters.length ? docs.length : 0, docs: [] };
          }
          if (target.path === 'invitations/invite-s') return { exists: true, data: () => invitation };
          return rows.has(target.path) ? { exists: true, data: () => rows.get(target.path) } : { exists: false };
        },
        update(target, value) { if (target.path === 'invitations/invite-s') invitation = { ...invitation, ...value }; },
        set(target, value) {
          if (/^waitingPatients\/[^/]+$/.test(target.path)) rows.set(target.path, { ...(rows.get(target.path) || {}), ...value });
        },
        delete() {},
      }));
      serial = operation.catch(() => {});
      return operation;
    },
  };
  const arrive = (id, status = 'waiting') => reserveWaitingVisit(db, 'invite-s', { timestamp: new Date() }, {
    id, roomName: 'room-s', status, newVisitId: `visit-${id}-${nextId++}`,
    onNewVisit: { invitationId: 'invite-s' }, onEachVisit: { roomName: 'room-s', invitationId: 'invite-s' },
  });
  const waiting = () => [...rows.values()].filter(row => row.status === 'waiting').length;
  return { arrive, waiting, rows };
}

// 1. The 2026-11-25 race: two distinct visitors at 9/10 arrive concurrently.
const race = fixture();
const outcomes = await Promise.all([race.arrive('new-a'), race.arrive('new-b')]);
assert.deepEqual(outcomes.map(o => o.outcome).sort(), ['full', 'reserved']);
assert.equal(race.waiting(), 10, 'Waiting target holds under concurrent arrivals');

// 2. Ten concurrent arrivals into an empty queue with a target of three.
const burst = fixture({ waitingRows: 0, maxPatients: 3 });
const burstOutcomes = await Promise.all(Array.from({ length: 10 }, (_, i) => burst.arrive(`burst-${i}`)));
assert.equal(burstOutcomes.filter(o => o.outcome === 'reserved').length, 3);
assert.equal(burst.waiting(), 3);

// 3. A full queue does not refuse someone already waiting, nor verified direct entry.
const full = fixture({ waitingRows: 10 });
assert.equal((await full.arrive('old-0')).outcome, 'reserved', 'Reconnect keeps its place');
assert.equal((await full.arrive('verified', 'admitted')).outcome, 'reserved', 'Direct entry adds no waiting row');
assert.equal(full.waiting(), 10);

// 4. A returning visitor gets a new visit id; a reconnect keeps it.
const visits = fixture({ waitingRows: 0 });
const first = await visits.arrive('returning');
const reconnect = await visits.arrive('returning');
assert.equal(reconnect.visitId, first.visitId);
visits.rows.get('waitingPatients/returning').status = 'left';
const second = await visits.arrive('returning');
assert.notEqual(second.visitId, first.visitId, 'Earlier-visit credentials no longer match');
assert.equal(second.startedNewVisit, true);

const report = {
  date: '2026-11-27',
  environment: 'local Node 22, actual reservation source with synthetic serialized-transaction adapter',
  source_baseline: 'ed4f7a9 plus working-tree queue fix (see commit that adds this file)',
  source_sha256: { [reservationPath]: createHash('sha256').update(readFileSync(reservationPath)).digest('hex') },
  cases: {
    concurrent_pair_at_9_of_10: { outcomes: outcomes.map(o => o.outcome), final_waiting: race.waiting() },
    ten_concurrent_into_target_3: { reserved: burstOutcomes.filter(o => o.outcome === 'reserved').length, final_waiting: burst.waiting() },
    full_queue_reconnect_and_direct_entry: 'both reserved; waiting stays 10',
    visit_binding: 'reconnect keeps visit id; return after leaving receives a new one',
  },
  claim_status: 'Atomic per-invitation waiting target PASSED in the local synthetic model. Not a cloud benchmark; deployed Firestore contention behavior still needs an emulator or staging check.',
  supersedes: 'docs/thesis-defense/evidence/queue-title-2026-11-25/source-audit.json (kept as the historical failing result)',
};
const output = 'docs/thesis-defense/evidence/queue-capacity-fix-2026-11-27/source-audit.json';
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

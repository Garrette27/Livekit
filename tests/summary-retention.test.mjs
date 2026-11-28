import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadAppointmentModule as loadModule } from './appointment-regressions.test.mjs';

const load = () => loadModule('lib/consultations/summary-retention.ts', { './retention-policy': { SUMMARY_RETENTION_DAYS: 30 } });

/** Minimal Firestore double: records batch deletes and the receipt write. */
function fakeDb(eligible) {
  const calls = { deleted: [], receipt: null, limit: null };
  const docs = Array.from({ length: eligible }, (_, i) => ({ id: `s${i}`, ref: { path: `call-summaries/s${i}` } }));
  const query = {
    count: () => ({ get: async () => ({ data: () => ({ count: eligible }) }) }),
    limit: (n) => { calls.limit = n; return { get: async () => ({ docs: docs.slice(0, n), size: Math.min(n, eligible) }) }; },
  };
  return {
    calls,
    collection: (name) => ({
      where: (field, op, value) => { calls.where = [name, field, op, value]; return query; },
      doc: (id) => ({ path: `${name}/${id}`, set: async (data) => { calls.receipt = { name, id, data }; } }),
    }),
    batch: () => ({ delete: (ref) => calls.deleted.push(ref.path), commit: async () => {} }),
  };
}

test('retention policy is opt-in, defaults to 30 days and rejects malformed windows', () => {
  const { summaryRetentionPolicy } = load();
  assert.deepEqual({ ...summaryRetentionPolicy({}) }, { enabled: false, days: 30 });
  assert.deepEqual({ ...summaryRetentionPolicy({ RETENTION_ENFORCEMENT_ENABLED: 'true', SUMMARY_RETENTION_DAYS: '14' }) }, { enabled: true, days: 14 });
  assert.equal(summaryRetentionPolicy({ SUMMARY_RETENTION_DAYS: '0' }).days, 30);
  assert.equal(summaryRetentionPolicy({ RETENTION_ENFORCEMENT_ENABLED: 'yes' }).enabled, false);
});

test('a dry run counts eligible summaries, deletes nothing and writes a metadata-only receipt', async () => {
  const { enforceSummaryRetention } = load();
  const db = fakeDb(7);
  const now = new Date('2026-11-28T03:00:00Z');
  const run = await enforceSummaryRetention(db, { enabled: false, days: 30 }, now);
  assert.equal(run.eligibleBefore, 7);
  assert.equal(run.deletedCount, 0);
  assert.deepEqual(db.calls.deleted, []);
  assert.equal(db.calls.where[0], 'call-summaries');
  assert.equal(db.calls.where[3].toISOString(), '2026-10-29T03:00:00.000Z');
  assert.equal(db.calls.receipt.name, 'retention-runs');
  assert.equal(db.calls.receipt.id, '2026-11-28');
  assert.deepEqual(Object.keys(db.calls.receipt.data).sort(), ['cutoff', 'days', 'deletedCount', 'eligibleBefore', 'enabled', 'ranAt', 'remainingMayExist']);
});

test('enforcement deletes one bounded page plus each schedule row, staying under the batch limit', async () => {
  const { enforceSummaryRetention, MAX_RETENTION_PAGE } = load();
  const db = fakeDb(250);
  const run = await enforceSummaryRetention(db, { enabled: true, days: 30 }, new Date('2026-11-28T03:00:00Z'));
  assert.equal(db.calls.limit, MAX_RETENTION_PAGE);
  assert.equal(run.deletedCount, 200);
  assert.equal(run.remainingMayExist, true);
  assert.ok(db.calls.deleted.length <= 500);
  assert.ok(db.calls.deleted.includes('scheduled-deletions/s0'));
});

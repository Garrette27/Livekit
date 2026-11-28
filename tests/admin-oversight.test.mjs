import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadAppointmentModule as loadModule } from './appointment-regressions.test.mjs';

const load = () => loadModule('lib/services/admin/oversight-service.ts', {});

/** Records every query shape; count() returns a fixed value; audit docs carry extra fields that must be dropped. */
function fakeDb() {
  const queries = [];
  const makeQuery = (collection, filters = []) => ({
    where: (field, op, value) => makeQuery(collection, [...filters, [field, op, value]]),
    orderBy: (field, dir) => makeQuery(collection, [...filters, ['orderBy', field, dir]]),
    limit: (n) => ({ get: async () => {
      queries.push({ collection, filters, limit: n });
      const docs = collection === 'adminAuditEvents'
        ? [{ id: 'e1', data: () => ({ action: 'role_grant', role: 'doctor', clinicId: 'c1', actorUid: 'a', targetUid: 't', at: new Date('2026-11-28T00:00:00Z'), patientEmail: 'leak@example.test' }) }]
        : [];
      return { docs };
    } }),
    count: () => ({ get: async () => { queries.push({ collection, filters, count: true }); return { data: () => ({ count: 3 }) }; } }),
  });
  return { queries, collection: (name) => makeQuery(name) };
}

test('a clinic administrator only receives queries scoped to their verified clinic', async () => {
  const { buildOversightSnapshot } = load();
  const db = fakeDb();
  const snapshot = await buildOversightSnapshot(db, { level: 'admin', clinicId: 'c1' });
  assert.equal(snapshot.scope, 'clinic');
  for (const query of db.queries) {
    assert.ok(query.filters.some(([field, op, value]) => field === 'clinicId' && op === '==' && value === 'c1'), JSON.stringify(query));
  }
  assert.ok(!db.queries.some((query) => ['invitations', 'call-summaries', 'consultationSessions'].includes(query.collection)));
});

test('a clinic administrator without a clinic gets an empty view, not platform data', async () => {
  const { buildOversightSnapshot } = load();
  const db = fakeDb();
  const snapshot = await buildOversightSnapshot(db, { level: 'admin', clinicId: null });
  assert.equal(db.queries.length, 0);
  assert.deepEqual([...snapshot.metrics], []);
});

test('platform view uses bounded aggregates and returns metadata-only audit rows', async () => {
  const { buildOversightSnapshot, AUDIT_PAGE_SIZE } = load();
  const db = fakeDb();
  const snapshot = await buildOversightSnapshot(db, { level: 'super_admin' });
  assert.equal(snapshot.scope, 'platform');
  assert.ok(db.queries.filter((q) => !q.count).every((q) => q.limit <= AUDIT_PAGE_SIZE));
  assert.deepEqual(Object.keys(snapshot.auditEvents[0]).sort(), ['action', 'actorUid', 'at', 'clinicId', 'id', 'role', 'targetUid']);
  assert.ok(!JSON.stringify(snapshot).includes('leak@example.test'));
});

test('oversight API derives scope from the verified caller and refuses non-administrators', () => {
  const route = readFileSync('app/api/admin/oversight/route.ts', 'utf8');
  assert.match(route, /authenticateBearerToken\(req\)/);
  assert.match(route, /if \(!level\)[\s\S]*status: 403/);
  assert.match(route, /clinicId: caller\.data\.clinicId/);
  assert.doesNotMatch(route, /searchParams|req\.json/);
});

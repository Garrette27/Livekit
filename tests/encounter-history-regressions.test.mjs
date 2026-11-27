import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createElement } from 'react';
import * as react from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

/** Run the real projection with synthetic repository-boundary IO. */
function loadModule(path, dependencies = {}, globals = {}) {
  const record = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(code, {
    module: record, exports: record.exports, Date,
    console: { log() {}, warn() {}, error() {} },
    require(name) {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
    ...globals,
  }, { filename: path });
  return record.exports;
}

const retention = loadModule('lib/consultations/retention-policy.ts');
const presentation = loadModule('lib/consultations/history-presentation.ts', {
  './retention-policy': retention,
});

/** Snapshot fixtures retain separate encounter ids even when their room matches. */
function projectionFixture() {
  const sessions = {
    'earlier-opening': {
      roomName: 'synthetic-room', doctorUserId: 'doctor-a', status: 'completed',
      sessionStartedAt: '2026-11-27T00:00:00Z', sessionEndedAt: '2026-11-27T00:02:00Z',
    },
    'current-opening': {
      roomName: 'synthetic-room', doctorUserId: 'doctor-a', status: 'active',
      sessionStartedAt: '2026-11-27T01:00:00Z',
    },
  };
  const summaries = {
    'earlier-opening': {
      roomName: 'synthetic-room', createdBy: 'doctor-a', category: 'No-Show',
      summary: 'Synthetic unattended record.', metadata: { summaryStatus: 'ready' },
    },
  };
  const snapshot = (id, value) => ({ id, exists: Boolean(value), data: () => value });
  let generations = 0;
  const { FirestoreSummaryProjectionService } = loadModule('lib/services/history-summary/summary-projection-service.ts', {
    '@/lib/consultations/identity-utils': loadModule('lib/consultations/identity-utils.ts'),
    '@/lib/services/consultation-finalization': {
      async generateAndStoreConsultationSummary() { generations++; },
    },
    '@/lib/repositories/call-summary-repository': { CallSummaryRepository: class {
      async findByDoctor() { return Object.entries(summaries).map(([id, data]) => snapshot(id, data)); }
      async getById(id) { return snapshot(id, summaries[id]); }
    } },
    '@/lib/repositories/consultation-session-repository': { ConsultationSessionRepository: class {
      async findByDoctor() { return Object.entries(sessions).map(([id, data]) => snapshot(id, data)); }
      async getById(id) { return snapshot(id, sessions[id]); }
    } },
    '@/lib/repositories/user-repository': { UserRepository: class {
      async getEmail() { return undefined; }
    } },
  });
  return { service: new FirestoreSummaryProjectionService({}), sessions, summaries, generations: () => generations };
}

test('doctor history shows an open encounter separately from a completed opening of the same room', async () => {
  const fixture = projectionFixture();
  const records = await fixture.service.buildDoctorHistory({ doctorUserId: 'doctor-a' });
  assert.equal(records.length, 2);
  const current = records.find(record => record.id === 'current-opening');
  const earlier = records.find(record => record.id === 'earlier-opening');
  assert.equal(current.encounterStatus, 'active');
  assert.equal(current.endedAt, null);
  assert.equal(current.summary, undefined);
  assert.equal(earlier.encounterStatus, 'completed');
  assert.equal(earlier.category, 'No-Show');
  assert.equal(fixture.generations(), 0, 'Reading history never generates a clinical or no-show record');
});

test('summary service rejects active encounters before a worker can create a premature no-show', async () => {
  const fixture = projectionFixture();
  await assert.rejects(
    fixture.service.buildSummary({ consultationSessionId: 'current-opening', regenerate: true }),
    /must end before/,
  );
  assert.equal(fixture.generations(), 0);
  assert.equal(fixture.summaries['current-opening'], undefined);
});

test('an explicit active session is not finalized by a stale end marker', async () => {
  const fixture = projectionFixture();
  fixture.sessions['current-opening'].sessionEndedAt = '2026-11-26T23:59:00Z';
  await assert.rejects(
    fixture.service.buildSummary({ consultationSessionId: 'current-opening', regenerate: true }),
    /must end before/,
  );
});

test('an active snapshot clears stale summary end metadata in the history projection', async () => {
  const fixture = projectionFixture();
  fixture.summaries['current-opening'] = {
    roomName: 'synthetic-room', createdBy: 'doctor-a',
    endedAt: '2026-11-26T23:59:00Z', metadata: {},
  };
  const records = await fixture.service.buildDoctorHistory({ doctorUserId: 'doctor-a' });
  const current = records.find(record => record.id === 'current-opening');
  assert.equal(current.encounterStatus, 'active');
  assert.equal(current.endedAt, null);
});

test('active encounter status wins over a stale no-show classification', () => {
  const result = presentation.resolveConsultationStatus({
    encounterStatus: 'active', hasGeneratedSummary: false, category: 'No-Show',
    startedAt: new Date('2026-11-27T01:00:00Z'), endedAt: null,
  }, new Date('2026-11-27T01:01:00Z'));
  assert.equal(result.status, 'not-finalized');
  assert.equal(result.label, 'Not finalized');
});

test('an old missing summary is unavailable without claiming an unobserved retention deletion', () => {
  const result = presentation.resolveConsultationStatus({
    encounterStatus: 'completed', hasGeneratedSummary: false,
    startedAt: new Date('2026-01-01T00:00:00Z'), endedAt: new Date('2026-01-01T00:01:00Z'),
  }, new Date('2026-11-27T00:00:00Z'));
  assert.equal(result.status, 'summary-unavailable');
  assert.doesNotMatch(result.label, /deleted|expired/i);
});

test('legacy completed sessions keep end-marker compatibility without inventing active status', async () => {
  const fixture = projectionFixture();
  delete fixture.sessions['earlier-opening'].status;
  const records = await fixture.service.buildDoctorHistory({ doctorUserId: 'doctor-a' });
  assert.equal(records.find(record => record.id === 'earlier-opening').encounterStatus, 'completed');
});

const ConsultationCard = loadModule('app/doctor/dashboard/components/ConsultationCard.tsx', {
  'react/jsx-runtime': jsxRuntime,
  '@/lib/consultations/history-presentation': presentation,
  '@/lib/consultations/retention-policy': retention,
}).default;

/** Render the real card without browser state or patient fixtures. */
function renderCard(overrides) {
  return renderToStaticMarkup(createElement(ConsultationCard, {
    record: {
      id: 'synthetic', roomName: 'synthetic-room', hasGeneratedSummary: false,
      summary: '', keyPoints: [], recommendations: [], followUpActions: [],
      category: 'General', riskLevel: 'Unknown', duration: 0,
      startedAt: new Date(), endedAt: null, ...overrides,
    },
    isGenerating: false, onGenerate() {}, onEdit() {},
  }));
}

test('open encounter card explains finalization without offering premature generation', () => {
  const markup = renderCard({ encounterStatus: 'active' });
  assert.match(markup, /Not finalized/);
  assert.match(markup, /summary.*after.*ends/i);
  assert.doesNotMatch(markup, /Generate summary|No summary has been generated/);
  assert.doesNotMatch(markup, /Under a minute/);
});

test('history counts open encounters separately and explains repeated invitation openings', () => {
  const History = loadModule('app/doctor/dashboard/components/ConsultationHistoryView.tsx', {
    react, 'react/jsx-runtime': jsxRuntime,
    './ConsultationCard': { default: ConsultationCard },
    '@/lib/consultations/history-presentation': presentation,
  }).default;
  const base = {
    roomName: 'synthetic-room', hasGeneratedSummary: false, summary: '', keyPoints: [],
    recommendations: [], followUpActions: [], category: 'General', riskLevel: 'Unknown',
    duration: 0, startedAt: new Date(), endedAt: null,
  };
  const markup = renderToStaticMarkup(createElement(History, {
    records: [
      { ...base, id: 'current', encounterStatus: 'active' },
      { ...base, id: 'earlier', encounterStatus: 'completed', category: 'No-Show' },
    ],
    loading: false, sortOrder: 'desc', onSortOrderChange() {},
    generatingSummaryId: null, onEdit() {}, onGenerate() {},
  }));
  const text = markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(text, /2 Consultations 1 Not finalized 0 Summarized 0 Awaiting summary/);
  assert.match(text, /1 No-shows/);
  assert.match(text, /Each row is a separate encounter, not an invitation/);
});

test('older missing summary card does not present an inferred deletion as a fact', () => {
  const markup = renderCard({
    encounterStatus: 'completed', startedAt: new Date('2026-01-01T00:00:00Z'),
    endedAt: new Date('2026-01-01T00:01:00Z'),
  });
  assert.match(markup, /Older summary unavailable/);
  assert.match(markup, /deletion has not been verified/);
  assert.doesNotMatch(markup, /permanently deleted|Generate summary/);
});

const results = loadModule('lib/services/shared/service-result.ts');
const jsonResponse = { json: (body, init = {}) => ({ body, status: init.status || 200 }) };
const http = loadModule('lib/services/shared/http.ts', {
  'next/server': { NextResponse: jsonResponse },
  './database-availability': loadModule('lib/services/shared/database-availability.ts'),
});

test('manual generation rejects active sessions even when an old end marker remains', async () => {
  for (const sessionEndedAt of [undefined, '2026-11-26T23:59:00Z']) {
    const fixture = projectionFixture();
    fixture.sessions['current-opening'].sessionEndedAt = sessionEndedAt;
    const { POST } = loadModule('app/api/summary/generate/route.ts', {
      '@/lib/firebase-admin': { getFirebaseAdmin: () => ({}) },
      '@/lib/repositories/consultation-session-repository': { ConsultationSessionRepository: class {
        async getById() { return { exists: true, data: () => fixture.sessions['current-opening'] }; }
      } },
      '@/lib/services/history-summary': { FirestoreSummaryProjectionService: class {
        constructor() { return fixture.service; }
      } },
      '@/lib/services/shared/http': http,
      '@/lib/services/shared/request-auth': { authorizeBearerRequest: async () => results.serviceOk({ userId: 'doctor-a', role: 'doctor' }) },
      '@/lib/services/shared/request-logging': { withRequestLogging: fn => fn },
      '@/lib/services/shared/service-result': results,
      '@/lib/rate-limit': { enforceRateLimit: async () => null, RateLimitConfigs: { SUMMARY_GENERATION: {} } },
    });
    const response = await POST({ json: async () => ({ consultationSessionId: 'current-opening' }) });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'consultation_active');
    assert.equal(fixture.generations(), 0);
  }
});

test('the cron worker cannot generate an active encounter despite a queued job', async () => {
  const fixture = projectionFixture();
  const failures = [];
  const { GET } = loadModule('app/api/summary/process-queue/route.ts', {
    'next/server': { NextResponse: jsonResponse },
    '@/lib/firebase-admin': { getFirebaseAdmin: () => ({}) },
    '@/lib/repositories/summary-job-repository': { SummaryJobRepository: class {
      async claimDue(limit) {
        assert.equal(limit, 5);
        return [{ id: 'current-opening', consultationSessionId: 'current-opening', attempts: 1 }];
      }
      async markFailed(id, code) { failures.push({ id, code }); }
    } },
    '@/lib/services/history-summary': { FirestoreSummaryProjectionService: class {
      constructor() { return fixture.service; }
    } },
    '@/lib/services/shared/request-logging': { withRequestLogging: fn => fn },
    '@/lib/services/shared/admin-secret-auth': { bearerSecretMatches: () => true },
  }, { process: { env: { CRON_SECRET: 'synthetic-not-a-secret' } } });
  const response = await GET({});
  assert.equal(response.status, 200);
  assert.equal(response.body.results[0].status, 'failed');
  assert.equal(failures[0].code, 'worker_failed');
  assert.equal(fixture.generations(), 0);
});

test('a regeneration racing with a clinician review cannot replace reviewed content', async () => {
  const reviewed = { summary: 'Synthetic reviewed record.', metadata: { isEdited: true, summaryStatus: 'reviewed', transcriptRevision: 1 } };
  let persisted = reviewed;
  const { CallSummaryRepository } = loadModule('lib/repositories/call-summary-repository.ts');
  const repository = new CallSummaryRepository({
    collection: () => ({ doc: () => ({}) }),
    runTransaction: callback => callback({
      get: async () => ({ exists: true, data: () => persisted }),
      set(_reference, content) { persisted = content; },
    }),
  });
  const stored = await repository.overwriteGenerated('synthetic', { summary: 'Synthetic later AI draft.' }, 2);
  assert.equal(stored, false);
  assert.equal(persisted, reviewed);
});

/** Exercise the deployed Function entry point using only synthetic, bounded document IO. */
function retentionFunctionFixture(env = {}, summaryCount = 401) {
  const documents = Array.from({ length: summaryCount }, (_, index) => ({
    id: `synthetic-${index}`, ref: { path: `call-summaries/synthetic-${index}` },
  }));
  let queryLimit;
  let cutoff;
  let operations = 0;
  let committed = 0;
  let reads = 0;
  const db = {
    collection(name) {
      assert.ok(name === 'call-summaries' || name === 'scheduled-deletions');
      return {
        where(field, operator, value) {
          assert.equal(name, 'call-summaries');
          assert.equal(field, 'createdAt');
          assert.equal(operator, '<');
          cutoff = value;
          return this;
        },
        limit(value) { queryLimit = value; return this; },
        async get() {
          reads++;
          const docs = documents.slice(0, queryLimit);
          return { docs, empty: docs.length === 0, size: docs.length };
        },
        doc(id) { return { path: `${name}/${id}` }; },
      };
    },
    batch() { return {
      delete() { operations++; },
      async commit() {
        assert.ok(operations <= 500, `One batch queued ${operations} operations`);
        committed++;
      },
    }; },
  };
  const firestore = Object.assign(() => db, { Timestamp: { fromDate: value => value } });
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-11-27T00:00:00Z'])); }
  }
  const exported = loadModule('functions/index.js', {
    'firebase-functions/v1': { pubsub: { schedule: value => {
      assert.equal(value, 'every 24 hours');
      return { onRun: callback => callback };
    } } },
    'firebase-admin': { initializeApp() {}, firestore },
    './activity-log-pipeline': {},
    './structured-logger': { logInfo() {}, logWarn() {}, logError() {} },
  }, { Date: FixedDate, process: { env } });
  return { run: exported.autoDeleteSummaries, stats: () => ({ queryLimit, cutoff, operations, committed, reads }) };
}

test('summary retention performs no reads or deletion before explicit operator opt-in', async () => {
  for (const flag of [undefined, 'false', 'TRUE']) {
    const fixture = retentionFunctionFixture({ RETENTION_ENFORCEMENT_ENABLED: flag });
    const result = await fixture.run();
    assert.equal(result.disabled, true);
    assert.equal(fixture.stats().operations, 0);
    assert.equal(fixture.stats().reads, 0);
  }
});

test('enabled retention deletes at most 200 summaries and schedules within one safe batch', async () => {
  const fixture = retentionFunctionFixture({ RETENTION_ENFORCEMENT_ENABLED: 'true' });
  const result = await fixture.run();
  assert.equal(result.deletedCount, 200);
  assert.equal(result.remainingMayExist, true);
  assert.equal(fixture.stats().operations, 400);
  assert.equal(fixture.stats().committed, 1);
  assert.equal(fixture.stats().cutoff.toISOString(), '2026-10-28T00:00:00.000Z');
});

test('retention uses the configured summary creation-age window instead of assuming 30 days', async () => {
  const fixture = retentionFunctionFixture({ RETENTION_ENFORCEMENT_ENABLED: 'true', SUMMARY_RETENTION_DAYS: '45' }, 0);
  const result = await fixture.run();
  assert.equal(result.deletedCount, 0);
  assert.equal(fixture.stats().cutoff.toISOString(), '2026-10-13T00:00:00.000Z');
  assert.equal(fixture.stats().committed, 0);
});

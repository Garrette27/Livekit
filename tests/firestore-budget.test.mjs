import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

/**
 * Free-tier budget invariants (Firestore Spark: 50k reads / 20k writes a day).
 * Each pins a fix for a measured-by-audit cost driver so it cannot regress.
 */
const require = createRequire(import.meta.url);
const read = (path) => readFileSync(path, 'utf8');

test('audit trigger writes one row per real change and nothing for bookkeeping-only updates', () => {
  const { isNoiseOnlyUpdate } = require('../functions/activity-log-pipeline.js');
  assert.equal(isNoiseOnlyUpdate('update', []), true, 'no-op merge');
  assert.equal(isNoiseOnlyUpdate('update', ['updatedAt', 'metadata.updatedAt']), true);
  assert.equal(isNoiseOnlyUpdate('update', ['lastMessageAt', 'updatedAt']), true, 'chat bump');
  assert.equal(isNoiseOnlyUpdate('update', ['transcription.revision', 'transcription.segmentCount', 'updatedAt']), true, 'transcript chunk progress');
  assert.equal(isNoiseOnlyUpdate('update', ['audit.lastAccessed']), true, 'invite validation touch');
  assert.equal(isNoiseOnlyUpdate('update', ['status', 'updatedAt']), false, 'state changes stay audited');
  assert.equal(isNoiseOnlyUpdate('create', []), false);
  assert.equal(isNoiseOnlyUpdate('delete', []), false);
  const source = read('functions/activity-log-pipeline.js');
  assert.doesNotMatch(source, /adminFeedRef|ADMIN_ACTIVITY_FEED_COLLECTION/, 'the unread duplicate feed copy is not written');
  assert.match(source, /await auditRef\.set\(auditPayload\)/);
});

test('the live queue never scans the doctor\'s whole visit history', () => {
  const core = read('lib/services/invitation-access/invitation-access-core.ts');
  assert.match(core, /where\('roomName', '==', input\.roomName\)/);
  assert.match(core, /where\('status', 'in', statuses\)/);
  const coordinator = read('lib/waiting-room/waiting-queue-coordinator.ts');
  assert.match(coordinator, /receivedInitialSnapshot/, 'initial snapshot does not trigger a duplicate fetch');
});

test('guest admission polling slows for long waits and webhooks spend no database quota on throttling', () => {
  const invite = read('app/invite/[token]/page.tsx');
  assert.match(invite, /3 \* 60_000 \? 4000 : 10_000/);
  const webhook = read('app/api/webhook/route.ts');
  assert.doesNotMatch(webhook, /enforceRateLimit/);
  assert.match(webhook, /checkRateLimit\(req, RateLimitConfigs\.WEBHOOK\)/);
});

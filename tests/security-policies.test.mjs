import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { resolve } from 'node:path';
import ts from 'typescript';

async function importTypeScriptModule(relativePath) {
  const source = await readFile(resolve(process.cwd(), relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const encoded = Buffer.from(output).toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

test('faculty reviewer remains deny-by-default except for assignment permission', async () => {
  const policy = await importTypeScriptModule('lib/auth/access-policy.ts');
  assert.equal(policy.roleHasPermission('faculty_reviewer', 'consultation:review-assigned'), true);
  assert.equal(policy.roleHasPermission('faculty_reviewer', 'consultation:read-own'), false);
  assert.equal(policy.roleHasPermission('faculty_reviewer', 'room:join-doctor'), false);
  assert.equal(policy.roleHasPermission('faculty_reviewer', 'summary:manage-own'), false);
});

test('review assignment is exact, active, and time bounded', async () => {
  const policy = await importTypeScriptModule('lib/auth/review-assignment-policy.ts');
  const now = new Date('2026-07-27T12:00:00.000Z');
  const assignment = {
    reviewerUserId: 'reviewer-1',
    consultationSessionId: 'session-1',
    purpose: 'Thesis review',
    grantedBy: 'admin-1',
    grantedAt: new Date('2026-07-27T11:00:00.000Z'),
    expiresAt: new Date('2026-07-27T13:00:00.000Z'),
    status: 'active',
  };

  assert.equal(
    policy.hasActiveReviewAssignment(assignment, {
      reviewerUserId: 'reviewer-1',
      consultationSessionId: 'session-1',
      now,
    }),
    true
  );
  assert.equal(
    policy.hasActiveReviewAssignment(assignment, {
      reviewerUserId: 'reviewer-2',
      consultationSessionId: 'session-1',
      now,
    }),
    false
  );
  assert.equal(
    policy.hasActiveReviewAssignment(assignment, {
      reviewerUserId: 'reviewer-1',
      consultationSessionId: 'session-2',
      now,
    }),
    false
  );
  assert.equal(
    policy.hasActiveReviewAssignment(
      { ...assignment, expiresAt: new Date('2026-07-27T11:59:59.000Z') },
      {
        reviewerUserId: 'reviewer-1',
        consultationSessionId: 'session-1',
        now,
      }
    ),
    false
  );
});

test('concurrent invitation reservations cannot exceed maxUses', async () => {
  const { reserveInvitationUse } = await importTypeScriptModule(
    'lib/invitations/invitation-use-reservation.ts'
  );
  const state = { currentUses: 0, maxUses: 2 };
  const auditEvents = [];
  let transactionQueue = Promise.resolve();

  const invitationRef = {
    collection() {
      return {
        doc() {
          return { kind: 'audit' };
        },
      };
    },
  };
  const db = {
    collection() {
      return {
        doc() {
          return invitationRef;
        },
      };
    },
    runTransaction(callback) {
      const run = transactionQueue.then(() =>
        callback({
          async get() {
            return { exists: true, data: () => ({ ...state }) };
          },
          update(_ref, patch) {
            state.currentUses = patch.currentUses;
          },
          set(_ref, event) {
            auditEvents.push(event);
          },
        })
      );
      transactionQueue = run.catch(() => undefined);
      return run;
    },
  };

  const results = await Promise.all([
    reserveInvitationUse(db, 'invite-1', { attempt: 1 }),
    reserveInvitationUse(db, 'invite-1', { attempt: 2 }),
    reserveInvitationUse(db, 'invite-1', { attempt: 3 }),
  ]);

  assert.deepEqual(results, [true, true, false]);
  assert.equal(state.currentUses, 2);
  assert.equal(auditEvents.length, 2);
});

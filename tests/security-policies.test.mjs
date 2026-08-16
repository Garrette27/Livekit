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
  const { recordExistingInvitationAccess, reserveInvitationUse } = await importTypeScriptModule(
    'lib/invitations/invitation-use-reservation.ts'
  );
  const state = { currentUses: 0, maxUses: 2 };
  const auditEvents = [];
  let transactionQueue = Promise.resolve();

  const invitationRef = {
    collection() {
      const auditCollection = {
        doc() {
          return { kind: 'audit' };
        },
        orderBy() {
          return auditCollection;
        },
        offset() {
          return auditCollection;
        },
        limit() {
          return { kind: 'audit-query' };
        },
      };
      return auditCollection;
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
          async get(reference) {
            if (reference?.kind === 'audit-query') {
              return { docs: [] };
            }
            return { exists: true, data: () => ({ ...state }) };
          },
          update(_ref, patch) {
            if (patch.currentUses !== undefined) {
              state.currentUses = patch.currentUses;
            }
          },
          set(_ref, event) {
            auditEvents.push(event);
          },
          delete() {},
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

  state.status = 'active';
  assert.equal(
    await recordExistingInvitationAccess(db, 'invite-1', { reconnect: true }),
    true,
    'an admitted reconnect does not consume another use'
  );
  assert.equal(state.currentUses, 2);

  state.status = 'revoked';
  assert.equal(
    await recordExistingInvitationAccess(db, 'invite-1', { reconnect: true }),
    false,
    'a revoke racing with reconnect prevents token issuance'
  );
});

test('consultation history sort values describe the resulting order', async () => {
  const retentionSource = await readFile(
    resolve(process.cwd(), 'lib/consultations/retention-policy.ts'),
    'utf8'
  );
  const retentionOutput = ts.transpileModule(retentionSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const retentionUrl = `data:text/javascript;base64,${Buffer.from(retentionOutput).toString('base64')}`;

  const presentationSource = await readFile(
    resolve(process.cwd(), 'lib/consultations/history-presentation.ts'),
    'utf8'
  );
  const presentationOutput = ts.transpileModule(
    presentationSource.replace("'./retention-policy'", `'${retentionUrl}'`),
    {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }
  ).outputText;
  const presentation = await import(
    `data:text/javascript;base64,${Buffer.from(presentationOutput).toString('base64')}`
  );

  const records = [
    { id: 'middle', startedAt: new Date('2026-08-10T10:00:00Z') },
    { id: 'newest', startedAt: new Date('2026-08-11T10:00:00Z') },
    { id: 'undated', startedAt: null },
    { id: 'oldest', startedAt: new Date('2026-08-09T10:00:00Z') },
  ];

  assert.deepEqual(
    presentation.sortConsultationRecords(records, 'desc').map((record) => record.id),
    ['newest', 'middle', 'oldest', 'undated']
  );
  assert.deepEqual(
    presentation.sortConsultationRecords(records, 'asc').map((record) => record.id),
    ['oldest', 'middle', 'newest', 'undated']
  );
});

test('waiting-room timestamp transport understands Firestore JSON shapes', async () => {
  const dates = await importTypeScriptModule('lib/time/date-value.ts');
  assert.equal(
    dates.dateValueToDate({ _seconds: 1_786_909_740, _nanoseconds: 500_000_000 }).toISOString(),
    '2026-08-16T19:49:00.500Z'
  );
  assert.equal(
    dates.dateValueToDate({ seconds: 1_786_909_740, nanoseconds: 0 }).toISOString(),
    '2026-08-16T19:49:00.000Z'
  );
  assert.equal(dates.dateValueToDate('not-a-date'), null);
});

test('invitation presentation counts hashed identities without exposing addresses', async () => {
  const presentation = await importTypeScriptModule(
    'lib/invitations/invitation-presentation.ts'
  );
  assert.equal(
    presentation.countDirectAdmissionIdentities({
      metadata: {
        constraints: {
          allowlistCount: 2,
          emailHashes: ['hash-a', 'hash-b'],
        },
      },
    }),
    2
  );
  assert.equal(
    presentation.countDirectAdmissionIdentities({
      emailAllowed: 'legacy@example.com',
      metadata: { constraints: { emails: ['legacy@example.com', 'second@example.com'] } },
    }),
    2
  );
});

test('prepared consultation capabilities default to disabled', async () => {
  const capabilities = await importTypeScriptModule(
    'lib/consultations/consultation-capabilities.ts'
  );
  assert.equal(capabilities.isConsultationCapabilityEnabled('file-attachments', {}), false);
  assert.equal(capabilities.isConsultationCapabilityEnabled('scheduling', {}), false);
  assert.equal(
    capabilities.isConsultationCapabilityEnabled('file-attachments', {
      ENABLE_FILE_ATTACHMENTS: 'true',
    }),
    true
  );
});

test('only a verified allowlisted identity skips the waiting room', async () => {
  const policy = await importTypeScriptModule('lib/invitations/admission-policy.ts');
  const verifiedVisitor = {
    userId: 'patient-1',
    authenticatedEmail: 'patient@example.com',
    emailVerified: true,
    isAnonymousAccount: false,
  };

  assert.equal(
    policy.decideAdmission({
      visitor: verifiedVisitor,
      allowlistConfigured: true,
      verifiedEmailAllowed: true,
    }).admit,
    'directly'
  );
  assert.equal(
    policy.decideAdmission({
      visitor: verifiedVisitor,
      allowlistConfigured: true,
      verifiedEmailAllowed: false,
    }).admit,
    'waiting-room'
  );
  assert.equal(
    policy.decideAdmission({
      visitor: { declaredEmail: 'patient@example.com' },
      allowlistConfigured: true,
      verifiedEmailAllowed: true,
    }).admit,
    'waiting-room',
    'typed email never grants direct admission'
  );
  assert.equal(
    policy.decideAdmission({
      visitor: verifiedVisitor,
      allowlistConfigured: false,
      verifiedEmailAllowed: false,
    }).admit,
    'waiting-room'
  );
});

test('security-signal hashing keeps production invitation validation available', async () => {
  const previousEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    SECURITY_SIGNAL_HASH_SECRET: process.env.SECURITY_SIGNAL_HASH_SECRET,
    INVITATION_TOKEN_SECRET: process.env.INVITATION_TOKEN_SECRET,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
  };

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.SECURITY_SIGNAL_HASH_SECRET;
    delete process.env.INVITATION_TOKEN_SECRET;
    process.env.LIVEKIT_API_SECRET = 'test-livekit-signing-secret';

    const securitySignals = await importTypeScriptModule(
      'lib/security/security-signal.ts'
    );
    const networkHash = securitySignals.hashSecuritySignal('ip', '203.0.113.8');
    const repeatedNetworkHash = securitySignals.hashSecuritySignal('ip', '203.0.113.8');
    const browserHash = securitySignals.hashSecuritySignal('user-agent', '203.0.113.8');
    const emailHash = securitySignals.hashSecuritySignal('email', 'patient@example.com');

    assert.match(networkHash, /^[a-f0-9]{64}$/);
    assert.equal(networkHash, repeatedNetworkHash);
    assert.notEqual(networkHash, browserHash, 'signal labels separate correlation domains');
    assert.notEqual(networkHash, emailHash, 'email allowlists use a separate correlation domain');

    process.env.SECURITY_SIGNAL_HASH_SECRET = 'dedicated-correlation-secret';
    assert.notEqual(
      securitySignals.hashSecuritySignal('ip', '203.0.113.8'),
      networkHash,
      'a dedicated secret takes precedence over the compatibility subkey'
    );

    delete process.env.SECURITY_SIGNAL_HASH_SECRET;
    delete process.env.LIVEKIT_API_SECRET;
    assert.throws(
      () => securitySignals.hashSecuritySignal('ip', '203.0.113.8'),
      /required in production/,
      'production still fails closed when no protected key material exists'
    );
  } finally {
    for (const [name, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});

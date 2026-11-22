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

test('review assignment denies blank identities and malformed persisted values without throwing', async () => {
  const { hasActiveReviewAssignment } = await importTypeScriptModule('lib/auth/review-assignment-policy.ts');
  const now = new Date('2026-11-22T12:00:00Z');
  const valid = {
    reviewerUserId: 'synthetic-reviewer', consultationSessionId: 'synthetic-session',
    purpose: 'Synthetic review', grantedBy: 'synthetic-admin',
    grantedAt: new Date('2026-11-22T11:00:00Z'), expiresAt: new Date('2026-11-22T13:00:00Z'), status: 'active',
  };
  const input = { reviewerUserId: valid.reviewerUserId, consultationSessionId: valid.consultationSessionId, now };
  assert.equal(hasActiveReviewAssignment(valid, input), true);
  for (const field of ['reviewerUserId', 'consultationSessionId']) {
    for (const value of ['', '   ']) {
      assert.equal(hasActiveReviewAssignment({ ...valid, [field]: value }, { ...input, [field]: value }), false);
    }
  }
  for (const field of ['purpose', 'grantedBy', 'reviewerUserId', 'consultationSessionId']) {
    for (const value of [null, undefined, 42, {}, '', '  ']) {
      assert.equal(hasActiveReviewAssignment({ ...valid, [field]: value }, input), false, field);
    }
  }
  for (const field of ['grantedAt', 'expiresAt']) {
    for (const value of [null, undefined, '2026-11-22', {}, new Date(NaN)]) {
      assert.equal(hasActiveReviewAssignment({ ...valid, [field]: value }, input), false, field);
    }
  }
  assert.equal(hasActiveReviewAssignment(valid, { ...input, now: new Date(NaN) }), false);
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
  const presentation = await importTypeScriptModuleWithDependencies(
    'lib/invitations/invitation-presentation.ts',
    { '@/lib/invitations/invitation-use-reservation': 'lib/invitations/invitation-use-reservation.ts' }
  );
  const reservation = await importTypeScriptModule('lib/invitations/invitation-use-reservation.ts');
  // The stored sentinel is presented as a policy, never as a number of uses.
  const reusableLabel = presentation.formatInvitationUsage({
    currentUses: 2,
    maxUses: reservation.REUSABLE_INVITATION_MAX_USES,
    waitingRoomEnabled: true,
  });
  assert.equal(reusableLabel, '2 joins · reusable until expiry');
  assert.doesNotMatch(reusableLabel, /\d{4,}/);
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

/** Like importTypeScriptModule, with the named relative imports resolved to other transpiled modules. */
async function importTypeScriptModuleWithDependencies(relativePath, dependencies) {
  const transpileToUrl = (source) =>
    `data:text/javascript;base64,${Buffer.from(
      ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText
    ).toString('base64')}`;

  let source = await readFile(resolve(process.cwd(), relativePath), 'utf8');
  for (const [specifier, dependencyPath] of Object.entries(dependencies)) {
    const dependencySource = await readFile(resolve(process.cwd(), dependencyPath), 'utf8');
    source = source.replace(`'${specifier}'`, `'${transpileToUrl(dependencySource)}'`);
  }
  return import(transpileToUrl(source));
}

test('Google and password accounts with a confirmed email are the same evidence', async () => {
  const policy = await importTypeScriptModule('lib/invitations/admission-policy.ts');
  const admitFromClaims = (claims) =>
    policy.decideAdmission({
      visitor: policy.visitorIdentityFromClaims(claims),
      allowlistConfigured: true,
      verifiedEmailAllowed: true,
    }).admit;

  assert.equal(
    admitFromClaims({
      uid: 'google-patient',
      email: 'patient@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    }),
    'directly'
  );
  assert.equal(
    admitFromClaims({
      uid: 'password-patient',
      email: 'patient@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    }),
    'directly'
  );
  assert.equal(
    admitFromClaims({
      uid: 'password-patient',
      email: 'patient@example.com',
      email_verified: false,
      firebase: { sign_in_provider: 'password' },
    }),
    'waiting-room',
    'a password account waits until its verification link is opened'
  );
  assert.equal(
    admitFromClaims({ uid: 'guest', firebase: { sign_in_provider: 'anonymous' } }),
    'waiting-room'
  );
});

test('consent is a versioned record, and the old registration flag is not it', async () => {
  const consent = await importTypeScriptModuleWithDependencies('lib/consent/telehealth-consent.ts', {
    '../consultations/retention-policy': 'lib/consultations/retention-policy.ts',
  });

  const recorded = consent.telehealthConsentRecord(new Date('2026-09-13T00:00:00Z'));
  assert.equal(consent.hasTelehealthConsent(recorded), true);
  assert.equal(
    consent.hasTelehealthConsent({ consentGiven: true }),
    false,
    'the old registration form agreed to hashing, not to the consultation'
  );
  assert.equal(
    consent.hasTelehealthConsent({
      consentGiven: false,
      consentVersion: consent.TELEHEALTH_CONSENT.version,
    }),
    false
  );
  assert.equal(consent.hasTelehealthConsent(undefined), false);
  assert.doesNotMatch(
    JSON.stringify(consent.TELEHEALTH_CONSENT),
    /phone|device|browser|network/i,
    'the statement asks for nothing the consultation does not use'
  );
});

test('exhausted AI credit is classified as unavailable, not a retryable failure', async () => {
  const errors = await importTypeScriptModule('lib/services/consultation-finalization/ai-provider-errors.ts');
  const json = (status, body) => new Response(JSON.stringify(body), { status });
  assert.equal(await errors.isQuotaExhaustedResponse(json(429, { error: { code: 'insufficient_quota', type: 'insufficient_quota' } })), true);
  // An ordinary rate limit is transient and keeps the retry path.
  assert.equal(await errors.isQuotaExhaustedResponse(json(429, { error: { code: 'rate_limit_exceeded' } })), false);
  assert.equal(await errors.isQuotaExhaustedResponse(json(500, { error: { code: 'insufficient_quota' } })), false);
  assert.equal(await errors.isQuotaExhaustedResponse(new Response('not json', { status: 429 })), false);
  // Classification must not consume the body callers may still read.
  const response = json(429, { error: { code: 'insufficient_quota' } });
  await errors.isQuotaExhaustedResponse(response);
  assert.equal(response.bodyUsed, false);
});

test('database availability failures are recognized from both Firestore SDKs', async () => {
  const availability = await importTypeScriptModule('lib/services/shared/database-availability.ts');
  // Server SDK gRPC codes: 8 quota exhausted, 4 deadline exceeded, 14 unavailable.
  for (const code of [8, 4, 14, 'resource-exhausted', 'deadline-exceeded', 'unavailable', 'RESOURCE_EXHAUSTED']) {
    assert.equal(availability.isDatabaseUnavailableError({ code }), true, `code ${code}`);
  }
  // Permission and logic errors are real faults and must not be disguised as outages.
  for (const error of [{ code: 7 }, { code: 'permission-denied' }, new Error('boom'), null, undefined]) {
    assert.equal(availability.isDatabaseUnavailableError(error), false);
  }
});

test('reserved waiting-room names cannot be claimed or joined as a doctor room', async () => {
  const { isDoctorClaimableRoomName, isWaitingRoomName } = await importTypeScriptModule('lib/rooms/room-name-policy.ts');
  assert.equal(isDoctorClaimableRoomName('dr-smith-0930'), true);
  assert.equal(isDoctorClaimableRoomName('dr-smith-0930-waiting'), false);
  assert.equal(isDoctorClaimableRoomName('DR-SMITH-WAITING'), false);
  assert.equal(isDoctorClaimableRoomName('dr-smith-waiting  '), false);
  assert.equal(isDoctorClaimableRoomName(''), false);
  assert.equal(isDoctorClaimableRoomName('   '), false);
  assert.equal(isDoctorClaimableRoomName('a'.repeat(129)), false);
  assert.equal(isDoctorClaimableRoomName(undefined), false);
  assert.equal(isDoctorClaimableRoomName({ toString: () => 'room' }), false);
  // A name that merely contains the word stays usable.
  assert.equal(isDoctorClaimableRoomName('waiting-list-review'), true);
  assert.equal(isWaitingRoomName('room-a-waiting'), true);
});

test('chat idempotency keys become safe, stable Firestore document ids', async () => {
  const { toChatMessageDocumentId, MAX_CHAT_MESSAGE_LENGTH } = await importTypeScriptModule('lib/chat/chat-message-key.ts');
  const liveKitId = '3f0c2a9e-6b1d-4c55-9a0e-1d2b3c4d5e6f';
  assert.equal(toChatMessageDocumentId(liveKitId), liveKitId);
  const fallbackKey = 'patient_inv_1:1763800000000:take 1/2 tablet';
  const mapped = toChatMessageDocumentId(fallbackKey);
  assert.match(mapped, /^k_[0-9a-f]{40}$/);
  assert.equal(mapped.includes('/'), false);
  assert.equal(mapped.includes('tablet'), false);
  assert.equal(toChatMessageDocumentId(fallbackKey), mapped, 'retries must deduplicate');
  assert.notEqual(toChatMessageDocumentId(`${fallbackKey}!`), mapped);
  assert.match(toChatMessageDocumentId('x'.repeat(2000)), /^k_[0-9a-f]{40}$/);
  assert.equal(MAX_CHAT_MESSAGE_LENGTH, 4000);
});

test('waiting entries are found only by a provider-verified email', async () => {
  const { verifiedLookupEmail } = await importTypeScriptModule('lib/invitations/admission-policy.ts');
  assert.equal(verifiedLookupEmail({ email: ' Patient@Example.test ', emailVerified: true }), 'patient@example.test');
  assert.equal(verifiedLookupEmail({ email: 'patient@example.test', emailVerified: false }), null);
  assert.equal(verifiedLookupEmail({ email: 'patient@example.test' }), null);
  assert.equal(verifiedLookupEmail({ email: '   ', emailVerified: true }), null);
  assert.equal(verifiedLookupEmail({ email: null, emailVerified: true }), null);
});

test('summary edits accept the dashboard shape and reject wrong-typed or oversized values', async () => {
  const { validateSummaryEdit, isSafeSummaryId, MAX_SUMMARY_EDIT_HISTORY } =
    await importTypeScriptModule('lib/services/summary-management/summary-edit-policy.ts');
  const dashboardEdit = {
    summaryId: 'abc123', summary: 'Reviewed.', keyPoints: ['a', ''], recommendations: [],
    followUpActions: ['Return in 2 weeks'], riskLevel: '', category: 'General',
  };
  const accepted = validateSummaryEdit(dashboardEdit);
  assert.equal(accepted.ok, true);
  assert.deepEqual(Object.keys(accepted.fields).sort(),
    ['category', 'followUpActions', 'keyPoints', 'recommendations', 'riskLevel', 'summary']);
  assert.equal('summaryId' in accepted.fields, false, 'only editable fields pass through');
  assert.deepEqual(validateSummaryEdit({}), { ok: true, fields: {} });
  assert.equal(validateSummaryEdit({ summary: 42 }).ok, false);
  assert.equal(validateSummaryEdit({ summary: 'x'.repeat(20001) }).ok, false);
  assert.equal(validateSummaryEdit({ keyPoints: 'not a list' }).ok, false);
  assert.equal(validateSummaryEdit({ keyPoints: [{ injected: true }] }).ok, false);
  assert.equal(validateSummaryEdit({ recommendations: Array(51).fill('x') }).ok, false);
  assert.equal(validateSummaryEdit({ riskLevel: 'x'.repeat(101) }).ok, false);
  assert.equal(isSafeSummaryId('abc123'), true);
  assert.equal(isSafeSummaryId('a/b'), false);
  assert.equal(isSafeSummaryId(''), false);
  assert.equal(isSafeSummaryId(7), false);
  assert.equal(MAX_SUMMARY_EDIT_HISTORY, 50);
});

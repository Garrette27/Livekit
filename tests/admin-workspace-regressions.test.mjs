import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function loadPolicy() {
  const record = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync('lib/auth/role-administration.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: record, exports: record.exports, Set });
  return record.exports;
}
const superEmails = new Set(['owner@example.test']);
const caller = { userId: 'u-1', email: 'staff@example.test', emailVerified: true, isAdminClaim: false };

test('the server sends admins to Administration and doctors to Invitations, without self-promotion', () => {
  const { resolveWorkspaceAccess } = loadPolicy();
  assert.equal(resolveWorkspaceAccess({ ...caller, isAdminClaim: true, clinicId: 'north-clinic', claimedRole: 'doctor' }, superEmails).homePath, '/admin');
  assert.equal(resolveWorkspaceAccess({ ...caller, claimedRole: 'doctor' }, superEmails).homePath, '/doctor/invitations');
  assert.equal(resolveWorkspaceAccess(caller, superEmails, 'doctor').homePath, '/doctor/invitations', 'Retain the existing legacy doctor transition');
  assert.equal(resolveWorkspaceAccess(caller, superEmails).homePath, null, 'An identity-only signup grants nothing');
  assert.equal(resolveWorkspaceAccess({ ...caller, claimedRole: 'patient' }, superEmails).homePath, '/patient/dashboard');
});

test('only a provider-verified configured owner receives bootstrap administration without a profile', () => {
  const { resolveWorkspaceAccess, presentManagedAccount } = loadPolicy();
  const owner = { ...caller, email: 'owner@example.test' };
  assert.equal(resolveWorkspaceAccess(owner, superEmails).administratorLevel, 'super_admin');
  assert.equal(resolveWorkspaceAccess({ ...owner, emailVerified: false }, superEmails).administratorLevel, null);
  const displayed = presentManagedAccount({ uid: 'u-1', email: owner.email, emailVerified: true, customClaims: {} }, { role: 'doctor' }, superEmails);
  assert.equal(displayed.role, 'super_admin');
  assert.equal(displayed.authority, 'server_bootstrap');
  assert.equal(displayed.canManage, false, 'A bootstrap account is not provisioned/revoked through a clinician row');
  const forgedProfile = presentManagedAccount({ uid: 'u-other', email: 'other@example.test', emailVerified: true, customClaims: {} }, { email: owner.email, role: 'doctor' }, superEmails);
  assert.notEqual(forgedProfile.role, 'super_admin', 'A profile label never bootstraps authority');
});

test('account presentation distinguishes administrator claims, doctor-only claims, legacy and disabled accounts', () => {
  const { presentManagedAccount } = loadPolicy();
  const record = { uid: 'u-2', email: 'staff@example.test', emailVerified: true, customClaims: { role: 'doctor', clinicId: 'north-clinic' } };
  assert.equal(presentManagedAccount(record, { role: 'doctor' }, superEmails).role, 'doctor');
  assert.equal(presentManagedAccount({ ...record, customClaims: { ...record.customClaims, admin: true } }, { role: 'doctor' }, superEmails).role, 'admin');
  assert.equal(presentManagedAccount({ ...record, customClaims: {} }, { role: 'doctor' }, superEmails).authority, 'legacy_profile');
  assert.equal(presentManagedAccount({ ...record, disabled: true }, { role: 'doctor' }, superEmails).authority, 'disabled');
});

test('role commands cannot change environment-managed bootstrap accounts', () => {
  const { decideRoleChange } = loadPolicy();
  const result = decideRoleChange({ caller: { ...caller, isAdminClaim: true, clinicId: 'north-clinic' }, superAdminEmails: superEmails, targetUserId: 'u-owner', targetIsSuperAdmin: true, role: 'doctor', action: 'revoke', targetClinicId: 'north-clinic' });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'bootstrap_managed');
});

function roleRoute(callerData, target = { uid: 'u-target', email: 'target@example.test', emailVerified: true, customClaims: {} }, lookupError = null) {
  const observed = { lookups: 0, claims: null, revocations: 0, audits: [] };
  const profile = { exists: true, data: () => ({ role: 'doctor', clinicId: 'north-clinic' }), async set() {} };
  const deps = {
    'next/server': { NextResponse: { json: (body, init = {}) => ({ status: init.status || 200, body }) } },
    '@/lib/services/shared/request-logging': { withRequestLogging: (fn) => fn },
    '@/lib/services/shared/request-auth': { authenticateBearerToken: async () => ({ ok: true, data: callerData }) },
    '@/lib/services/shared/http': {},
    '@/lib/firebase-admin': {
      getFirebaseAdmin: () => ({ collection: () => ({ doc: () => ({ get: async () => profile, set: profile.set }), add: async (event) => observed.audits.push(event), where() { return this; }, limit() { return this; }, async get() { return { docs: [{ id: 'u-target', data: profile.data }] }; } }) }),
      getFirebaseAdminAuth: () => ({ getUser: async () => { if (lookupError) throw lookupError; return target; }, getUserByEmail: async () => { observed.lookups++; if (lookupError) throw lookupError; return target; }, setCustomUserClaims: async (_, claims) => { observed.claims = claims; }, revokeRefreshTokens: async () => { observed.revocations++; } }),
    },
    '@/lib/rate-limit': { enforceRateLimit: async () => null, RateLimitConfigs: { TOKEN_GENERATION: {} } },
    '@/lib/auth/role-administration': loadPolicy(),
  };
  const record = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync('app/api/admin/roles/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module: record, exports: record.exports, Date, process: { env: { SUPER_ADMIN_EMAILS: 'owner@example.test' } }, require: (name) => { assert.ok(name in deps, name); return deps[name]; } });
  return { observed, post: (body) => record.exports.POST({ json: async () => body }), get: () => record.exports.GET({}) };
}

test('an ordinary signed-in account cannot enumerate role targets before authorization', async () => {
  const h = roleRoute(caller);
  assert.equal((await h.post({ email: 'missing@example.test', role: 'doctor', action: 'grant' })).status, 403);
  assert.equal(h.observed.lookups, 0);
});

test('doctor and administrator grant commands have different real claim effects and grants do not revoke sessions', async () => {
  const owner = { ...caller, email: 'owner@example.test' };
  for (const role of ['doctor', 'admin']) {
    const h = roleRoute(owner);
    assert.equal((await h.post({ email: 'target@example.test', role, action: 'grant', clinicId: 'north-clinic' })).status, 200);
    assert.equal(h.observed.claims.role, 'doctor');
    assert.equal(h.observed.claims.admin === true, role === 'admin');
    assert.equal(h.observed.revocations, 0);
    assert.equal(h.observed.audits.length, 1);
  }
});

test('a malformed JSON null role command returns 400 rather than throwing', async () => {
  const h = roleRoute({ ...caller, email: 'owner@example.test' });
  assert.equal((await h.post(null)).status, 400);
  assert.equal(h.observed.lookups, 0);
});

test('an Auth lookup outage is retryable, not an assertion that the account is missing', async () => {
  const owner = { ...caller, email: 'owner@example.test' };
  const h = roleRoute(owner, null, { code: 'auth/internal-error' });
  assert.equal((await h.get()).status, 503);
  assert.equal((await h.post({ email: 'target@example.test', role: 'doctor', action: 'grant' })).status, 503);
});

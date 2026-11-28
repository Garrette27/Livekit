import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { entryNodes, entryText, loginEntryHarness } from './helpers/login-entry-harness.mjs';

function loadPolicy() {
  const record = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync('lib/auth/role-administration.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: record, exports: record.exports, Set });
  return record.exports;
}
const superEmails = new Set(['owner@example.test']);
const caller = { userId: 'u-1', email: 'staff@example.test', emailVerified: true, isAdminClaim: false };

const loginAccess = {
  doctor: { administratorLevel: null, doctorAccess: true, homePath: '/doctor/invitations', clinicId: 'north-clinic' },
  admin: { administratorLevel: 'admin', doctorAccess: false, homePath: '/admin', clinicId: 'north-clinic' },
  super_admin: { administratorLevel: 'super_admin', doctorAccess: false, homePath: '/admin', clinicId: null },
  patient: { administratorLevel: null, doctorAccess: false, homePath: '/patient/dashboard', clinicId: null },
  faculty_reviewer: { administratorLevel: null, doctorAccess: false, homePath: null, clinicId: null },
  unassigned: { administratorLevel: null, doctorAccess: false, homePath: null, clinicId: null },
};

for (const method of ['google', 'password']) {
  test(`doctor ${method} entry rejects every non-doctor before profile writes or workspace navigation`, async () => {
    for (const role of ['admin', 'super_admin', 'patient', 'faculty_reviewer', 'unassigned']) {
      const h = loginEntryHarness('/doctor/login', loginAccess[role]);
      await h.login(method);
      assert.deepEqual(h.observed.redirects, [], role);
      assert.equal(h.auth.currentUser, null, `${role} is signed out`);
      assert.equal(h.observed.writes.length, 0, `${role} has no clinician profile side effects`);
      assert.ok(entryNodes(h.render(), node => node.props?.role === 'alert').some(node => entryText(node).length > 0), 'The rejected sign-in has an announced explanation');
    }
    const doctor = loginEntryHarness('/doctor/login', loginAccess.doctor);
    await doctor.login(method);
    assert.deepEqual(doctor.observed.redirects, ['/doctor/invitations']);
    assert.equal(doctor.observed.signouts, 0);
  });

  test(`doctor ${method} rejection leaves the other sign-in method usable`, async () => {
    for (const role of ['admin', 'super_admin']) {
      const access = { ...loginAccess[role] };
      const h = loginEntryHarness('/doctor/login', access);
      await h.login(method);
      assert.equal(h.auth.currentUser, null);
      assert.deepEqual(h.observed.redirects, []);

      Object.assign(access, loginAccess.doctor);
      const retryMethod = method === 'google' ? 'password' : 'google';
      if (retryMethod === 'google') await h.click('Google');
      await h.login(retryMethod);
      assert.deepEqual(h.observed.redirects, ['/doctor/invitations'], `${role} rejection permits another account to sign in`);
      assert.equal(h.observed.signouts, 1);
    }
  });

  for (const [route, allowedRole, heading] of [
    ['/admin/login', 'admin', 'Clinic administrator sign in'],
    ['/super-admin/login', 'super_admin', 'Super administrator sign in'],
  ]) {
    test(`${route} ${method} entry accepts only ${allowedRole} and signs out other roles`, async () => {
      for (const role of Object.keys(loginAccess)) {
        const h = loginEntryHarness(route, loginAccess[role]);
        await h.login(method);
        assert.deepEqual(h.observed.redirects, role === allowedRole ? ['/admin'] : [], role);
        assert.equal(h.auth.currentUser !== null, role === allowedRole, role);
        assert.equal(h.observed.identityCreations, 0, 'Sign-in cannot register or provision an account');
        assert.equal(h.observed.writes.length, 0, 'Administrative entry never writes clinical profiles');
        assert.ok(entryText(h.render()).includes(heading), 'The page identifies its intended administrator');
        if (role !== allowedRole) assert.ok(entryNodes(h.render(), node => node.props?.role === 'alert').some(node => entryText(node).length > 0));
      }
    });
  }
}

test('administrator access refresh enforces the selected entry audience on an existing session', async () => {
  for (const [route, accepted, rejected] of [
    ['/admin/login', 'admin', 'super_admin'], ['/super-admin/login', 'super_admin', 'admin'],
  ]) {
    for (const role of [accepted, rejected]) {
      const h = loginEntryHarness(route, loginAccess[role], { existingSession: true });
      await h.click('Check access again');
      assert.deepEqual(h.observed.redirects, role === accepted ? ['/admin'] : []);
      assert.equal(h.auth.currentUser !== null, role === accepted);
    }
  }
});

test('doctor entry and platform-owner entry expose only their intended sign-in choices', () => {
  const doctor = loginEntryHarness('/doctor/login', loginAccess.doctor);
  const doctorLinks = entryNodes(doctor.render(), node => node.props?.href).map(node => node.props.href);
  assert.equal(doctorLinks.some(path => path.startsWith('/admin') || path.startsWith('/super-admin')), false);
  const owner = loginEntryHarness('/super-admin/login', loginAccess.super_admin);
  assert.equal(entryNodes(owner.render(), node => node.props?.href?.endsWith('/signup')).length, 0, 'Platform-owner authority is provisioned through server configuration');
});

test('clinic signup creates only an identity and cannot enter administration without a role grant', async () => {
  const h = loginEntryHarness('/admin/signup', loginAccess.unassigned);
  await h.login('password');
  assert.equal(h.observed.identityCreations, 1);
  assert.equal(h.observed.writes.length, 0);
  assert.deepEqual(h.observed.redirects, []);
  await h.click('Check access again');
  assert.deepEqual(h.observed.redirects, []);
});

test('clinic signup uses the same clinic-only Google access check and never converts a platform owner', async () => {
  for (const role of ['admin', 'super_admin']) {
    const h = loginEntryHarness('/admin/signup', loginAccess[role]);
    await h.login('google');
    assert.deepEqual(h.observed.redirects, role === 'admin' ? ['/admin'] : []);
    assert.equal(h.auth.currentUser !== null, role === 'admin');
    assert.equal(h.observed.writes.length, 0);
    assert.equal(h.observed.identityCreations, 0);
  }
});

test('an unavailable server access check cannot navigate or create a clinician profile', async () => {
  for (const route of ['/doctor/login', '/admin/login', '/super-admin/login']) {
    const h = loginEntryHarness(route, loginAccess.doctor, { accessError: true });
    await h.login('google');
    assert.deepEqual(h.observed.redirects, [], route);
    assert.equal(h.observed.writes.length, 0);
    assert.ok(entryNodes(h.render(), node => node.props?.role === 'alert').some(node => entryText(node).length > 0));
  }
});

test('the server sends admins to Administration and doctors to Invitations, without self-promotion', () => {
  const { resolveWorkspaceAccess } = loadPolicy();
  assert.equal(resolveWorkspaceAccess({ ...caller, isAdminClaim: true, clinicId: 'north-clinic', claimedRole: 'doctor' }, superEmails).homePath, '/admin');
  assert.equal(resolveWorkspaceAccess({ ...caller, claimedRole: 'doctor' }, superEmails).homePath, '/doctor/invitations');
  assert.equal(resolveWorkspaceAccess(caller, superEmails, 'doctor').homePath, '/doctor/invitations', 'Retain the existing legacy doctor transition');
  assert.equal(resolveWorkspaceAccess(caller, superEmails).homePath, null, 'An identity-only signup grants nothing');
  assert.equal(resolveWorkspaceAccess({ ...caller, claimedRole: 'patient' }, superEmails).homePath, '/patient/dashboard');
  assert.equal(resolveWorkspaceAccess({ ...caller, isAdminClaim: true, claimedRole: 'doctor' }, superEmails).doctorAccess, false);
  assert.equal(resolveWorkspaceAccess({ ...caller, claimedRole: 'admin' }, superEmails).doctorAccess, false);
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

test('platform owners are administrative only even with historical doctor/admin claims', () => {
  const { resolveWorkspaceAccess } = loadPolicy();
  for (const claims of [{ claimedRole: 'doctor' }, { claimedRole: 'admin', isAdminClaim: true }, {}]) {
    const access = resolveWorkspaceAccess({ ...caller, ...claims, email: 'owner@example.test' }, superEmails, 'doctor');
    assert.equal(access.doctorAccess, false);
    assert.equal(access.homePath, '/admin');
  }
});

function requestAuthorization(decoded, configuredOwners = 'owner@example.test') {
  const observed = { profileReads: 0 };
  const policy = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync('lib/auth/access-policy.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: policy, exports: policy.exports, Set });
  const deps = {
    '@/lib/firebase-admin': { getFirebaseAdmin: () => ({}), getFirebaseAdminAuth: () => ({ verifyIdToken: async (_token, checkRevoked) => (typeof decoded === 'function' ? decoded(checkRevoked) : decoded) }) },
    '@/lib/auth/access-policy': policy.exports,
    '@/lib/auth/role-administration': loadPolicy(),
    '@/lib/repositories/user-repository': { UserRepository: class { async getById() { observed.profileReads++; return { exists: true, data: () => ({ role: 'doctor' }) }; } } },
    './request-logging': { recordAuthenticatedUser() {} },
    './service-result': { serviceOk: (data) => ({ ok: true, data }), serviceError: (status, code, message) => ({ ok: false, error: { status, code, message } }) },
    './database-availability': {},
  };
  const record = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync('lib/services/shared/request-auth.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module: record, exports: record.exports, process: { env: { SUPER_ADMIN_EMAILS: configuredOwners } }, console: { warn() {}, error() {} }, require: (name) => { assert.ok(name in deps, name); return deps[name]; } });
  return { observed, authorize: (permission) => record.exports.authorizeBearerRequest({ headers: new Headers({ authorization: 'Bearer synthetic-token' }) }, permission) };
}

test('the server denies every clinical permission to configured platform owners before profile fallback', async () => {
  const h = requestAuthorization({ uid: 'owner', email: 'owner@example.test', email_verified: true, role: 'doctor', admin: true });
  for (const permission of ['invitation:manage', 'room:join-doctor', 'room:join-patient', 'consultation:read-own', 'summary:manage-own', 'waiting-room:manage']) {
    const result = await h.authorize(permission);
    assert.equal(result.ok, false, permission);
    assert.equal(result.error.code, 'administration_only');
  }
  assert.equal(h.observed.profileReads, 0);
  assert.equal((await requestAuthorization({ uid: 'doctor', email: 'staff@example.test', email_verified: true, role: 'doctor' }).authorize('room:join-doctor')).ok, true);
  const clinicAdmin = requestAuthorization({ uid: 'clinic-admin', email: 'admin@example.test', role: 'doctor', admin: true });
  assert.equal((await clinicAdmin.authorize('room:join-doctor')).ok, false, 'Historical combined admin/doctor claims grant no clinical access');
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
  const observed = { lookups: 0, claims: null, revocations: 0, audits: [], profileWrites: [] };
  const profile = { exists: true, data: () => ({ role: 'doctor', clinicId: 'north-clinic' }), async set(value) { observed.profileWrites.push(value); } };
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
    assert.equal(h.observed.claims.role, role);
    assert.equal(h.observed.claims.admin === true, role === 'admin');
    assert.equal(h.observed.revocations, 0);
    assert.equal(h.observed.audits.length, 1);
  }
});

test('removing an administrator does not silently restore legacy doctor access', async () => {
  const h = roleRoute({ ...caller, email: 'owner@example.test' }, { uid: 'u-target', email: 'target@example.test', customClaims: { role: 'doctor', admin: true, clinicId: 'north-clinic' } });
  assert.equal((await h.post({ email: 'target@example.test', role: 'admin', action: 'revoke' })).status, 200);
  assert.equal(h.observed.claims.role, undefined);
  assert.equal(h.observed.claims.admin, undefined);
  assert.equal(h.observed.profileWrites[0].role, 'revoked');
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

test('a revoked doctor is refused on the next API request, not after token expiry', async () => {
  const revoked = requestAuthorization((checkRevoked) => {
    assert.equal(checkRevoked, true, 'Protected APIs must ask Firebase to check revocation');
    throw Object.assign(new Error('revoked'), { code: 'auth/id-token-revoked' });
  });
  const result = await revoked.authorize('invitation:manage');
  assert.equal(result.ok, false);
  assert.equal(result.error.status, 401);
  assert.equal(result.error.code, 'session_revoked');
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { setImmediate } from 'node:timers/promises';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

/** Execute entry-page behavior with synthetic identity-provider and database IO. */
function loadModule(path, dependencies) {
  const record = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module: record, exports: record.exports, console: { log() {}, warn() {}, error() {} },
    require(name) { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; },
  }, { filename: path });
  return record.exports;
}

export function entryText(node) {
  if (Array.isArray(node)) return node.map(entryText).join(' ');
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  return entryText(node.props?.children);
}

export function entryNodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => entryNodes(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...entryNodes(node.props?.children, predicate)];
}

/** Preserve hook state between renders while executing the real page's callbacks. */
export function loginEntryHarness(route, access, { existingSession = false, accessError = false } = {}) {
  const hooks = [];
  let cursor = 0, dirty = false;
  const effects = [];
  const observed = { redirects: [], writes: [], signouts: 0, identityCreations: 0, accessChecks: 0 };
  const user = { uid: 'synthetic-staff', email: 'staff@example.test', displayName: 'Synthetic staff' };
  const auth = { currentUser: existingSession ? user : null, async signOut() { observed.signouts++; auth.currentUser = null; } };
  const signIn = async () => { auth.currentUser = user; return { user }; };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], value => { if (!Object.is(hooks[index], value)) { hooks[index] = value; dirty = true; } }];
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      if (!(index in hooks) || dependencies.some((value, i) => !Object.is(value, hooks[index][i]))) effects.push(effect);
      hooks[index] = dependencies;
    },
  };
  const dependencies = {
    react,
    'react/jsx-runtime': jsxRuntime,
    'next/link': { default: 'a' },
    'next/navigation': { useRouter: () => ({ push: path => observed.redirects.push(path), replace: path => observed.redirects.push(path) }) },
    'firebase/auth': {
      signInWithPopup: signIn, signInWithEmailAndPassword: signIn, sendPasswordResetEmail: async () => {}, sendEmailVerification: async () => {},
      createUserWithEmailAndPassword: async () => { observed.identityCreations++; return signIn(); },
    },
    '@/lib/firebase': { auth, provider: {}, db: {} },
    'firebase/firestore': {
      doc: (_db, collection, id) => ({ collection, id }),
      getDoc: async () => ({ exists: () => true, data: () => ({ role: 'doctor' }) }),
      setDoc: async (reference, value) => observed.writes.push({ reference, value }), serverTimestamp: () => 'synthetic-time',
    },
    '@/lib/auth/role-conflict': { checkRoleConflictByEmail: async () => ({ hasConflict: false }), RoleConflictUnavailableError: class extends Error {} },
    '@/lib/auth/workspace-client': { fetchWorkspaceAccess: async () => {
      observed.accessChecks++;
      if (accessError) throw new Error('Synthetic access service outage');
      return access;
    } },
    '@/components/ui/feedback/PageSkeleton': { default: 'page-skeleton' },
  };
  let Component, props = {};
  if (route === '/doctor/login') Component = loadModule('app/doctor/login/page.tsx', dependencies).default;
  else {
    dependencies['@/components/admin/AdministratorEntry'] = loadModule('components/admin/AdministratorEntry.tsx', dependencies);
    const page = loadModule(`app${route}/page.tsx`, dependencies).default();
    Component = page.type;
    props = page.props;
  }
  const render = () => {
    let tree;
    do {
      dirty = false; cursor = 0;
      tree = Component(props);
      effects.splice(0).forEach(effect => effect());
    } while (dirty);
    return tree;
  };
  const click = async label => {
    const button = entryNodes(render(), node => node.type === 'button' && entryText(node).includes(label))[0];
    assert.ok(button, `Missing button ${label}`);
    await button.props.onClick();
    await setImmediate();
  };
  const login = async method => {
    if (method === 'google') return click(route === '/doctor/login' ? 'Sign in with Google' : 'Continue with Google');
    if (route === '/doctor/login') await click('Email');
    for (const [type, value] of [['email', user.email], ['password', 'synthetic-password']]) {
      const input = entryNodes(render(), node => node.type === 'input' && node.props.type === type)[0];
      assert.ok(input, `Missing ${type} input`);
      input.props.onChange({ target: { value } });
    }
    const form = entryNodes(render(), node => node.type === 'form')[0];
    await form.props.onSubmit({ preventDefault() {} });
    await setImmediate();
  };
  return { render, login, click, auth, observed };
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

/** Render production components with only browser/transport boundaries replaced. */
function loadModule(path, dependencies) {
  const record = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, {
    module: record, exports: record.exports, console, URL, URLSearchParams, Response, Date, React,
    require(name) {
      if (name === 'react') return React;
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return record.exports;
}

test('docked room panels occupy layout space instead of covering the call', () => {
  const Sidebar = loadModule('components/CollapsibleSidebar.tsx', {
    '@/hooks/useIsCompactViewport': { useIsCompactViewport: () => false },
  }).default;
  const markup = renderToStaticMarkup(React.createElement(Sidebar, {
    title: 'Waiting Queue', icon: 'WQ', position: 'left', width: 360,
  }, 'Synthetic queue'));
  assert.match(markup, /position:relative/);
  assert.match(markup, /flex-shrink:0/);
  assert.doesNotMatch(markup, /position:fixed/);
});

/** The route's real authority check must run before its minimized projection. */
function invitationRoute(owner = 'doctor-a') {
  const invitation = {
    createdBy: owner, roomName: 'synthetic-room', status: 'active',
    expiresAt: new Date('2099-01-02T00:00:00Z'), createdAt: new Date('2026-11-27T01:00:00Z'),
    waitingRoomEnabled: true, maxPatients: 4,
    metadata: { constraints: { emailHashes: ['opaque-a', 'opaque-b'], allowlistCount: 2 } },
  };
  const presentation = loadModule('lib/invitations/invitation-presentation.ts', {
    '@/lib/invitations/invitation-use-reservation': { REUSABLE_INVITATION_MAX_USES: 999999 },
  });
  return loadModule('app/api/invite/get-link/route.ts', {
    '@/lib/services/shared/request-logging': { withRequestLogging: (fn) => fn },
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '../../../../lib/firebase-admin': { getFirebaseAdmin: () => ({ synthetic: true }) },
    '../../../../lib/invitations/token-utils': { signInvitationToken: () => 'synthetic-token' },
    '../../../../lib/invitations/utils': { buildInviteUrl: () => 'https://example.test/invite/synthetic', toDate: (value, fallback) => value instanceof Date ? value : fallback },
    '../../../../lib/services/consultation-finalization': { finalizeConsultationForRoom() { throw new Error('Unexpected write'); } },
    '../../../../lib/repositories/invitation-repository': { InvitationRepository: class { getById() { return { exists: true, id: 'invite-a', data: () => invitation }; } } },
    '@/lib/services/shared/request-auth': { authorizeBearerRequest: async () => ({ ok: true, data: { userId: 'doctor-a' } }) },
    '@/lib/services/shared/http': { unexpectedErrorResponse: (error) => { throw error; } },
    '@/lib/invitations/invitation-presentation': presentation,
  }).GET;
}

test('the owning doctor receives invitation counts and times but no identity hashes', async () => {
  const response = await invitationRoute()({ url: 'https://example.test/api/invite/get-link?invitationId=invite-a' });
  const body = await response.json();
  assert.deepEqual(body.invitationContext, {
    directAdmissionEmailCount: 2, waitingCapacity: 4,
    createdAt: '2026-11-27T01:00:00.000Z', expiresAt: '2099-01-02T00:00:00.000Z',
  });
  assert.equal(JSON.stringify(body).includes('opaque-'), false);
});

test('another doctor cannot obtain invitation context', async () => {
  const response = await invitationRoute('doctor-b')({ url: 'https://example.test/api/invite/get-link?invitationId=invite-a' });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).invitationContext, undefined);
});

test('cached invitation links retain the same minimized context', async () => {
  let reads = 0;
  const client = loadModule('lib/invitations/invitation-link-client.ts', {
    '@/lib/auth/authenticated-fetch': { authenticatedFetch: async () => {
      reads++;
      return Response.json({ success: true, inviteUrl: 'https://example.test/invite/synthetic', invitationContext: { directAdmissionEmailCount: 2, waitingCapacity: 4, createdAt: null, expiresAt: '2099-01-02T00:00:00.000Z' } });
    } },
  });
  await client.fetchInvitationLink({ roomName: 'synthetic-room' });
  const cached = await client.fetchInvitationLink({ roomName: 'synthetic-room' });
  assert.equal(cached.invitationContext?.directAdmissionEmailCount, 2);
  assert.equal(reads, 1);
});

test('the call queue shows identity provenance and progressively disclosed arrival times', () => {
  const Panel = loadModule('app/room/[room]/doctor/components/WaitingRoomPanel.tsx', {
    '@/hooks/useWaitingQueue': { useWaitingQueue: () => ({ waitingPatients: [{ id: 'entry-a', status: 'waiting', patientName: 'Synthetic visitor', patientEmail: 'visitor@example.test', joinedAt: new Date('2026-11-27T01:00:00Z'), metadata: { identitySource: 'self-declared' } }], loading: false }) },
    '@/components/ui/feedback/ToastProvider': { useToast: () => ({ showToast() {} }) },
    '@/lib/time/date-value': loadModule('lib/time/date-value.ts', {}),
  }).default;
  const markup = renderToStaticMarkup(React.createElement(Panel, { roomName: 'synthetic-room' }));
  assert.match(markup, /Unverified/);
  assert.match(markup, /<details/);
  assert.match(markup, /Arrived/);
  assert.doesNotMatch(markup, /Verified patient/);
});

test('a compact room starts with a labelled action rather than an open sheet', () => {
  const Sidebar = loadModule('components/CollapsibleSidebar.tsx', {
    '@/hooks/useIsCompactViewport': { useIsCompactViewport: () => true },
  }).default;
  const markup = renderToStaticMarkup(React.createElement(Sidebar, {
    title: 'Waiting Queue', icon: 'WQ', position: 'left',
  }, 'Synthetic queue'));
  assert.match(markup, /aria-expanded="false"/);
  assert.doesNotMatch(markup, /Synthetic queue/);
});

test('tablet widths choose the same on-demand room arrangement as phones', () => {
  let query;
  const record = { exports: {} };
  const code = ts.transpileModule(readFileSync('hooks/useIsCompactViewport.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    module: record, exports: record.exports,
    require: () => ({ useState: () => [false, () => {}], useEffect: (effect) => effect() }),
    window: { matchMedia(value) { query = value; return { matches: true, addEventListener() {}, removeEventListener() {} }; } },
  });
  record.exports.useIsCompactViewport();
  for (const width of [320, 390, 768, 820, 1024]) {
    assert.ok(width <= Number(query.match(/max-width:\s*(\d+)px/)[1]), `${width}px must not dock two panels over video`);
  }
});

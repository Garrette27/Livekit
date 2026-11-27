import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, posix } from 'node:path';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const room = 'app/room/[room]';

/**
 * Bundle the real doctor workspace into an isolated browser. Only authentication,
 * network/clinical IO, and the LiveKit media transport are synthetic. This never
 * opens a patient room or depends on an authenticated deployment.
 */
export function consultationBrowserFixture() {
  const stubs = {
    react: readFileSync(resolve(dirname(require.resolve('react')), 'cjs/react.production.js'), 'utf8'),
    'react-dom': readFileSync(resolve(dirname(require.resolve('react-dom')), 'cjs/react-dom.production.js'), 'utf8'),
    'react-dom/client': readFileSync(resolve(dirname(require.resolve('react-dom')), 'cjs/react-dom-client.production.js'), 'utf8'),
    scheduler: readFileSync(resolve(dirname(require.resolve('scheduler')), 'cjs/scheduler.production.js'), 'utf8'),
    'firebase/firestore': 'exports.doc = () => null; exports.setDoc = async () => {};',
    '@/lib/firebase': 'exports.db = null;',
    '@/lib/consultations/doctor-presence-client': 'exports.trackDoctorPresenceEvent = async () => {};',
    [`${room}/doctor/hooks/useDoctorAuth`]: `exports.useDoctorAuth = () => ({ user: { uid: 'synthetic-doctor', displayName: 'Demo doctor' }, isAuthenticated: true, doctorName: 'Demo doctor', clearAuthError() {} });`,
    [`${room}/doctor/hooks/useDoctorToken`]: `exports.useDoctorToken = () => ({ token: 'synthetic-token', clearTokenError() {} });`,
    [`${room}/doctor/hooks/useRoomLifecycle`]: `exports.useRoomLifecycle = () => ({ consultationSessionId: 'synthetic-session' });`,
    [`${room}/doctor/hooks/useSpeechCapture`]: `exports.useSpeechCapture = () => ({ speechStatus: 'unsupported', startCapture() {}, stopCapture() {} });`,
    [`${room}/doctor/hooks/useErrorHandler`]: `exports.useErrorHandler = () => ({ pageError: null, setPageError() {} });`,
    '@/hooks/useWaitingQueue': `exports.useWaitingQueue = () => ({ waitingPatients: [{ id: 'synthetic-entry', roomName: 'synthetic-room', patientName: 'Demo visitor', patientEmail: 'visitor@example.test', status: 'waiting', joinedAt: new Date(), metadata: { identitySource: 'self-declared' } }], loading: false });`,
    '@/components/ui/feedback/ToastProvider': 'exports.useToast = () => ({ showToast() {} });',
    '@/lib/invitations/invitation-link-client': `exports.fetchInvitationLink = async () => ({ success: true, inviteUrl: 'https://example.test/invite/synthetic', invitationContext: { directAdmissionEmailCount: 2, waitingCapacity: 4, createdAt: '2026-11-27T00:00:00Z', expiresAt: '2099-01-02T00:00:00Z' } }); exports.copyTextToClipboard = async () => {};`,
    'next/link': `const React = require('react'); module.exports = ({children, ...props}) => React.createElement('a', props, children);`,
    'livekit-client': `exports.VideoPresets = { h720: { resolution: { width: 1280, height: 720 } } };`,
    [`${room}/components/shared/SessionTranscriptionBridge`]: `const React = require('react'); module.exports = ({consentConfirmed}) => React.createElement('span', { 'data-testid': 'transcription-state', 'data-active': String(consentConfirmed) });`,
    '@livekit/components-react': `
      const React = require('react');
      exports.PreJoin = ({onSubmit}) => React.createElement('button', {onClick: () => onSubmit({ audioEnabled: false, videoEnabled: false })}, 'Join consultation');
      exports.LiveKitRoom = ({children, style}) => React.createElement('div', {style}, children);
      exports.VideoConference = () => React.createElement('div', {className: 'lk-video-conference'},
        React.createElement('div', {className: 'lk-grid-layout', 'data-testid': 'video-canvas'}, React.createElement('div', {className: 'lk-participant-tile', style: {background: '#172b45'}})),
        React.createElement('div', {className: 'lk-control-bar'}, ['Microphone','Camera','Chat'].map(label => React.createElement('button', {key: label}, label))));
      exports.ConnectionStateToast = () => null;
      exports.useChat = () => ({chatMessages: []});
      exports.useLocalParticipant = () => ({localParticipant: {identity: 'synthetic-doctor'}});
      exports.useParticipants = () => [];
      exports.useConnectionState = () => 'connected';
    `,
  };
  const modules = {};
  const visit = (id) => {
    if (modules[id]) return;
    let code = stubs[id];
    if (code === undefined) {
      let source;
      for (const extension of ['.tsx', '.ts']) {
        try { source = readFileSync(`${id}${extension}`, 'utf8'); break; } catch {}
      }
      assert.ok(source, `Missing fixture module: ${id}`);
      code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    }
    modules[id] = { code, dependencies: {} };
    for (const [, , name] of code.matchAll(/require\((['"])([^'"]+)\1\)/g)) {
      const dependency = name.startsWith('.') ? posix.normalize(posix.join(posix.dirname(id), name)) : stubs[name] !== undefined ? name : name.startsWith('@/') ? name.slice(2) : name;
      modules[id].dependencies[name] = dependency;
      visit(dependency);
    }
  };
  const entry = `${room}/doctor/page`;
  visit(entry);
  visit('react-dom/client');
  const factories = Object.entries(modules).map(([id, value]) => `${JSON.stringify(id)}: function(module, exports, require) { ${value.code}\n }`).join(',');
  const dependencyMaps = Object.fromEntries(Object.entries(modules).map(([id, value]) => [id, value.dependencies]));
  return `
    window.process = { env: { NODE_ENV: 'production' } };
    const factories = {${factories}};
    const dependencies = ${JSON.stringify(dependencyMaps)};
    const cache = {};
    function load(id) {
      if (cache[id]) return cache[id].exports;
      const module = cache[id] = { exports: {} };
      factories[id](module, module.exports, name => load(dependencies[id][name]));
      return module.exports;
    }
    window.React = load('react');
    const Page = load(${JSON.stringify(entry)}).default;
    const root = load('react-dom/client').createRoot(document.getElementById('root'));
    let mount = 0;
    window.remountWorkspace = () => root.render(React.createElement(Page, { key: ++mount, params: Promise.resolve({room: 'synthetic-room'}) }));
    window.remountWorkspace();
  `;
}

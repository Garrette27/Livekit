/**
 * Local end-to-end encryption trial. Runs our real media-key issuer and our
 * real browser preparation module against a real LiveKit server, with four
 * headless Chromium participants using fake camera/mic:
 *   doctor + patient (app key)  -> must see each other, with no decrypt errors;
 *   eavesdropper with a wrong key, and one without E2EE -> must decode 0 frames.
 * Prerequisite (the SFU only forwards ciphertext it cannot read):
 *   docker run -d --rm --name lk-e2ee-test -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
 *     livekit/livekit-server --dev --bind 0.0.0.0 --node-ip 127.0.0.1
 * Run: node scripts/thesis/e2ee-media-trial.mjs  (writes the evidence JSON)
 */
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const require = createRequire(`${ROOT}/package.json`);
const env = { LIVEKIT_API_KEY: 'devkey', LIVEKIT_API_SECRET: 'secret', LIVEKIT_E2EE_SECRET: 'trial-e2ee-secret-trial-e2ee-secret-0001' };
const cjs = (path, modules) => {
  const record = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  runInNewContext(code, { module: record, exports: record.exports, process: { env }, Buffer, URL, Date, JSON, console, require: (n) => modules[n] ?? require(n) });
  return record.exports;
};
const tokenUtils = cjs('lib/invitations/token-utils.ts', {});
const media = cjs('lib/livekit/media-encryption.ts', { '@/lib/invitations/token-utils': tokenUtils });
const clientModule = ts.transpileModule(readFileSync('lib/livekit/media-encryption-client.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const dist = `${ROOT}/node_modules/livekit-client/dist`;

const page = `<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"livekit-client":"/lk/livekit-client.esm.mjs"}}</script>
<video id="v" autoplay muted playsinline width="320" height="240"></video>
<script type="module">
import * as LK from 'livekit-client';
import { prepareConsultationRoom } from '/lib/livekit/media-encryption-client.js';
const q = new URLSearchParams(location.search);
const mode = q.get('mode');
const token = await (await fetch('/token?id=' + q.get('id'))).text();
window.result = { mode, encryptionErrors: 0 };
let room;
if (mode === 'app') {
  const prep = await prepareConsultationRoom(token, {});
  window.result.preparation = prep.kind + (prep.encryption ? ':' + prep.encryption : '');
  room = prep.room;
} else if (mode === 'wrong-key') {
  const keyProvider = new LK.ExternalE2EEKeyProvider();
  const worker = new Worker('/lib/livekit/livekit-client/e2ee-worker');
  room = new LK.Room({ encryption: { keyProvider, worker } });
  await keyProvider.setKey('a-guessed-key-that-is-not-the-room-key');
  await room.setE2EEEnabled(true);
} else {
  room = new LK.Room();
}
room.on(LK.RoomEvent.EncryptionError, () => window.result.encryptionErrors++);
room.on(LK.RoomEvent.TrackSubscribed, (track, _pub, participant) => { if (track.kind === 'video' && participant.identity === 'doctor_trial') track.attach(document.getElementById('v')); });
await room.connect('ws://127.0.0.1:7880', token);
await room.localParticipant.enableCameraAndMicrophone();
window.result.localEncrypting = room.isE2EEEnabled;
window.room = room;
window.ready = true;
</script>`;

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (body, type) => { res.writeHead(200, { 'Content-Type': type }); res.end(body); };
  if (url.pathname === '/') return send(page, 'text/html');
  if (url.pathname === '/token') return send(tokenUtils.signLiveKitRoomToken({ subject: url.searchParams.get('id'), roomName: 'trial-room' }), 'text/plain');
  if (url.pathname === '/lib/livekit/media-encryption-client.js') return send(clientModule, 'text/javascript');
  if (url.pathname === '/lib/livekit/livekit-client/e2ee-worker') return send(readFileSync(`${dist}/livekit-client.e2ee.worker.js`), 'text/javascript');
  if (url.pathname.startsWith('/lk/')) return send(readFileSync(`${dist}/${url.pathname.slice(4)}`), 'text/javascript');
  if (url.pathname === '/api/livekit/media-key') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => { const r = media.issueRoomMediaKey(JSON.parse(body).accessToken); res.writeHead(r.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(r.body)); });
    return;
  }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(8123, r));

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const open = async (id, mode) => {
  const context = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const p = await context.newPage();
  p.on('pageerror', (e) => console.log(id, 'pageerror', e.message));
  await p.goto(`http://localhost:8123/?id=${id}&mode=${mode}`);
  await p.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  return p;
};
const doctor = await open('doctor_trial', 'app');
const patient = await open('patient_trial', 'app');
await new Promise((r) => setTimeout(r, 12000));
const pairOnly = {
  doctorDecryptErrors: await doctor.evaluate(() => window.result.encryptionErrors),
  patientDecryptErrors: await patient.evaluate(() => window.result.encryptionErrors),
};
const wrongKey = await open('eavesdropper_wrong_key', 'wrong-key');
const plaintext = await open('eavesdropper_no_e2ee', 'plain');
await new Promise((r) => setTimeout(r, 15000));

// What each viewer gets from the doctor's camera: decoded frames and whether the picture has real content.
const observe = (p) => p.evaluate(async () => {
  const v = document.getElementById('v');
  let framesDecoded = 0;
  const remote = [...window.room.remoteParticipants.values()].find((x) => x.identity === 'doctor_trial');
  const pub = remote && [...remote.trackPublications.values()].find((t) => t.kind === 'video');
  if (pub?.track) (await pub.track.getRTCStatsReport())?.forEach((s) => { if (s.type === 'inbound-rtp') framesDecoded += s.framesDecoded || 0; });
  let lumaStdDev = null;
  if (v.videoWidth) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 48;
    const g = c.getContext('2d'); g.drawImage(v, 0, 0, 64, 48);
    const d = g.getImageData(0, 0, 64, 48).data; const l = [];
    for (let i = 0; i < d.length; i += 4) l.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    const m = l.reduce((a, b) => a + b, 0) / l.length; lumaStdDev = Math.round(Math.sqrt(l.reduce((a, b) => a + (b - m) ** 2, 0) / l.length) * 10) / 10;
  }
  return { ...window.result, doctorTrackSubscribed: Boolean(pub?.track), framesDecoded, videoSize: v.videoWidth ? `${v.videoWidth}x${v.videoHeight}` : null, lumaStdDev, doctorMarkedEncrypted: remote?.isEncrypted ?? null };
});
const report = {
  testedAtUtc: new Date().toISOString(),
  environment: 'local livekit-server --dev (docker) + headless Chromium fake camera/mic; same issuer and client modules as production',
  doctorPatientPairBeforeEavesdroppers: pairOnly,
  patientWithAppKey: await observe(patient),
  eavesdropperWithWrongKey: await observe(wrongKey),
  eavesdropperWithoutE2EE: await observe(plaintext),
};
report.verdict = report.patientWithAppKey.framesDecoded > 0
  && pairOnly.doctorDecryptErrors === 0 && pairOnly.patientDecryptErrors === 0
  && report.eavesdropperWithWrongKey.framesDecoded === 0
  && report.eavesdropperWithoutE2EE.framesDecoded === 0 ? 'PASS' : 'FAIL';
console.log(JSON.stringify(report, null, 2));
const out = 'docs/thesis-defense/evidence/e2ee-trial-2026-11-27';
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/e2ee-media-trial.json`, `${JSON.stringify(report, null, 2)}\n`);
await browser.close();
server.close();

/**
 * Two-browser LiveKit media reproduction harness (diagnostic, not a CI test).
 *
 * Runs a doctor page and a patient page in separate Chromium contexts (like a
 * normal + incognito window) against a LOCAL LiveKit dev server
 * (`docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp
 * livekit/livekit-server:v1.9 --dev --bind 0.0.0.0`). It uses the installed
 * livekit-client build and E2EE worker with the same room options as
 * RoomShell's ROOM_MEDIA_OPTIONS, Chromium's synthetic camera/microphone, and
 * a random throwaway E2EE key. No production credentials, tokens, identities
 * or clinical data are used; participant ids are synthetic.
 *
 * Every second each page records per-track WebRTC stat DELTAS (not cumulative
 * counters) plus room/track/video-element lifecycle events, so a visible
 * stall can be tied to a cause. Usage:
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=... node scripts/diagnostics/livekit-media-repro.mjs \
 *     [--scenario=baseline|no-e2ee|no-simulcast|background|tile-resize|camera-restart] [--seconds=30] [--out=file.json]
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { chromium } from '@playwright/test';
import { AccessToken } from 'livekit-server-sdk';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')));
const scenario = args.scenario || 'baseline';
const seconds = Number(args.seconds || 30);
const LIVEKIT_URL = process.env.DIAG_LIVEKIT_URL || 'ws://127.0.0.1:7880';
const room = `diag-${scenario}-${Date.now()}`;
const e2eeKey = randomBytes(32).toString('base64');

const page = `<!doctype html><html><body style="margin:0;background:#000">
<video id="local" autoplay muted playsinline style="width:480px;height:270px"></video>
<video id="remote" autoplay muted playsinline style="width:640px;height:720px"></video>
<script src="/livekit-client.umd.js"></script>
<script>
const LK = window.LivekitClient;
const log = [];
const t0 = performance.now();
const at = () => Math.round(performance.now() - t0);
const ev = (type, detail = {}) => log.push({ t: at(), type, ...detail });
window.__diag = { log, samples: [] };

for (const id of ['local', 'remote']) {
  const el = document.getElementById(id);
  for (const name of ['loadedmetadata', 'resize', 'emptied', 'stalled', 'waiting', 'playing', 'pause', 'suspend']) {
    el.addEventListener(name, () => ev('video-element', { el: id, event: name, w: el.videoWidth, h: el.videoHeight }));
  }
}

window.start = async ({ url, token, key, e2ee, simulcast }) => {
  const options = {
    adaptiveStream: { pauseVideoInBackground: false },
    dynacast: true,
    videoCaptureDefaults: { resolution: LK.VideoPresets.h720.resolution },
    publishDefaults: { simulcast, red: true, dtx: true },
  };
  let room;
  if (e2ee) {
    const keyProvider = new LK.ExternalE2EEKeyProvider();
    const worker = new Worker('/e2ee-worker.js');
    room = new LK.Room({ ...options, encryption: { keyProvider, worker } });
    await keyProvider.setKey(key);
    await room.setE2EEEnabled(true);
  } else {
    room = new LK.Room(options);
  }
  window.__room = room;
  const E = LK.RoomEvent;
  for (const name of ['TrackSubscribed', 'TrackUnsubscribed', 'TrackMuted', 'TrackUnmuted', 'TrackStreamStateChanged',
    'TrackSubscriptionStatusChanged', 'TrackSubscriptionPermissionChanged', 'LocalTrackPublished', 'LocalTrackUnpublished',
    'Reconnecting', 'Reconnected', 'SignalReconnecting', 'EncryptionError', 'MediaDevicesError', 'ActiveDeviceChanged',
    'ParticipantEncryptionStatusChanged', 'TrackSubscriptionFailed']) {
    room.on(E[name], (...a) => {
      const pub = a.find((x) => x && x.trackSid);
      const track = a.find((x) => x && x.sid && x.kind);
      ev('room', { event: name, sid: pub?.trackSid || track?.sid, source: pub?.source || track?.source, state: typeof a[1] === 'string' ? a[1] : undefined, error: a[0] && a[0].name });
    });
  }
  room.on(E.TrackSubscribed, (track) => {
    if (track.kind === 'video') {
      track.on('elementAttached', () => ev('track', { event: 'elementAttached', sid: track.sid }));
      track.on('elementDetached', () => ev('track', { event: 'elementDetached', sid: track.sid }));
      track.attach(document.getElementById('remote'));
    }
  });
  await room.connect(url, token);
  await room.localParticipant.enableCameraAndMicrophone();
  const cam = room.localParticipant.getTrackPublication(LK.Track.Source.Camera);
  cam?.videoTrack?.attach(document.getElementById('local'));
  ev('connected', { e2ee: room.isE2EEEnabled });

  const prev = new Map();
  setInterval(async () => {
    const sample = { t: at(), visibility: document.visibilityState, tracks: [] };
    const pubs = [...room.localParticipant.trackPublications.values(), ...[...room.remoteParticipants.values()].flatMap((p) => [...p.trackPublications.values()])];
    for (const pub of pubs) {
      const track = pub.track;
      if (!track || track.kind !== 'video') continue;
      let report;
      try { report = await track.getRTCStatsReport(); } catch { continue; }
      const codecs = new Map();
      report?.forEach((s) => { if (s.type === 'codec') codecs.set(s.id, s.mimeType); });
      report?.forEach((s) => {
        if (s.type !== 'inbound-rtp' && s.type !== 'outbound-rtp') return;
        if (s.kind !== 'video') return;
        const key = s.type + ':' + (s.ssrc || s.id);
        const p = prev.get(key) || {};
        const d = (f) => (typeof s[f] === 'number' ? s[f] - (p[f] || 0) : null);
        prev.set(key, s);
        sample.tracks.push({
          dir: s.type === 'inbound-rtp' ? 'in' : 'out', rid: s.rid, sid: pub.trackSid, source: pub.source,
          remote: !room.localParticipant.trackPublications.has(pub.trackSid),
          muted: pub.isMuted, subscribed: pub.isSubscribed, streamState: track.streamState,
          codec: codecs.get(s.codecId), impl: s.decoderImplementation || s.encoderImplementation,
          w: s.frameWidth, h: s.frameHeight, fps: s.framesPerSecond,
          dDecoded: d('framesDecoded'), dDropped: d('framesDropped'), dFreeze: d('freezeCount'), dFreezeSec: d('totalFreezesDuration'),
          dKey: d('keyFramesDecoded'), dPli: d('pliCount'), dNack: d('nackCount'), dLost: d('packetsLost'),
          dEncoded: d('framesEncoded'), limit: s.qualityLimitationReason, active: s.active,
        });
      });
    }
    window.__diag.samples.push(sample);
  }, 1000);
};
</script></body></html>`;

const files = {
  '/': ['text/html', Buffer.from(page)],
  '/livekit-client.umd.js': ['text/javascript', readFileSync('node_modules/livekit-client/dist/livekit-client.umd.js')],
  '/e2ee-worker.js': ['text/javascript', readFileSync('node_modules/livekit-client/dist/livekit-client.e2ee.worker.js')],
};
const server = createServer((req, res) => {
  const file = files[req.url.split('?')[0]];
  if (!file) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': file[0] }).end(file[1]);
}).listen(0);
const origin = `http://127.0.0.1:${server.address().port}/`;

async function token(identity) {
  const at = new AccessToken('devkey', 'secret', { identity });
  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
  return at.toJwt();
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const opts = { e2ee: scenario !== 'no-e2ee', simulcast: scenario !== 'no-simulcast' };
const pages = {};
for (const role of ['doctor', 'patient']) {
  const context = await browser.newContext({ permissions: ['camera', 'microphone'], viewport: { width: 1280, height: 800 } });
  const p = await context.newPage();
  await p.goto(origin);
  await p.evaluate((input) => window.start(input), { url: LIVEKIT_URL, token: await token(`synthetic-${role}`), key: e2eeKey, ...opts });
  pages[role] = p;
}

const half = Math.floor(seconds / 2);
await new Promise((r) => setTimeout(r, half * 1000));
if (scenario === 'background') {
  // Hide the doctor's page behind another tab in the same context (real visibility change).
  const other = await pages.doctor.context().newPage();
  await other.goto('about:blank');
  await other.bringToFront();
} else if (scenario === 'camera-restart') {
  // Same code path as choosing another camera in the device menu: the patient's
  // capture track is restarted (new getUserMedia + replaceTrack) while publishing.
  for (let i = 0; i < 3; i += 1) {
    await pages.patient.evaluate(async () => {
      const pub = window.__room.localParticipant.getTrackPublication(window.LivekitClient.Track.Source.Camera);
      await pub.videoTrack.restartTrack();
    });
    await new Promise((r) => setTimeout(r, 3000));
  }
} else if (scenario === 'tile-resize') {
  await pages.doctor.evaluate(() => { document.getElementById('remote').style.width = '200px'; document.getElementById('remote').style.height = '120px'; });
}
await new Promise((r) => setTimeout(r, (seconds - half) * 1000));

const result = { scenario, seconds, room: '[synthetic]', switchAtSecond: half, pages: {} };
for (const [role, p] of Object.entries(pages)) result.pages[role] = await p.evaluate(() => window.__diag);
await browser.close();
server.close();

const summary = {};
for (const [role, diag] of Object.entries(result.pages)) {
  const inbound = diag.samples.flatMap((s) => s.tracks.filter((t) => t.dir === 'in').map((t) => ({ ...t, t: s.t, visibility: s.visibility })));
  const total = (f) => inbound.reduce((sum, t) => sum + (t[f] || 0), 0);
  summary[role] = {
    codec: [...new Set(inbound.map((t) => t.codec).filter(Boolean))],
    decoder: [...new Set(inbound.map((t) => t.impl).filter(Boolean))],
    framesDecoded: total('dDecoded'), framesDropped: total('dDropped'), freezes: total('dFreeze'),
    keyframes: total('dKey'), pli: total('dPli'), nack: total('dNack'), lost: total('dLost'),
    sendLimits: [...new Set(diag.samples.flatMap((s) => s.tracks.filter((t) => t.dir === 'out').map((t) => t.limit)))],
    lifecycle: diag.log.filter((e) => e.type !== 'video-element' || !['playing', 'resize', 'loadedmetadata'].includes(e.event)).map((e) => `${e.t}ms ${e.type}:${e.event}${e.state ? '=' + e.state : ''}${e.error ? ' ' + e.error : ''}`),
    perSecondIn: inbound.map((t) => `${Math.round(t.t / 1000)}s ${t.visibility} ${t.w}x${t.h} dec+${t.dDecoded} drop+${t.dDropped} frz+${t.dFreeze} key+${t.dKey} pli+${t.dPli} ${t.streamState}`),
  };
}
if (args.out) writeFileSync(args.out, JSON.stringify(result, null, 1));
console.log(JSON.stringify({ scenario, summary }, null, 1));

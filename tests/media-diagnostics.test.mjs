import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadAppointmentModule as loadModule } from './appointment-regressions.test.mjs';

const problems = () => loadModule('lib/livekit/device-problems.ts');
const diagnostics = () => loadModule('lib/livekit/media-diagnostics.ts', {}, { Map, Math });

test('only the failing device is named, and "in use" is never described as blocked', () => {
  const { deviceForKind, describeDeviceProblems } = problems();
  assert.equal(deviceForKind('videoinput'), 'camera');
  assert.equal(deviceForKind('audioinput'), 'microphone');
  assert.equal(deviceForKind(undefined), null);
  const inUse = describeDeviceProblems({ camera: 'in-use' });
  assert.match(inUse, /^The camera is in use by another app or browser window/);
  assert.doesNotMatch(inUse, /blocked|microphone/);
  assert.match(describeDeviceProblems({ microphone: 'blocked' }), /^The microphone is blocked for this site/);
  const both = describeDeviceProblems({ camera: 'blocked', microphone: 'blocked' });
  assert.match(both, /^The camera and microphone are blocked for this site/);
  assert.equal(both.match(/blocked/g).length, 1, 'a shared cause is stated once');
  assert.equal(describeDeviceProblems({}), null);
});

test('the notice classifies with MediaDeviceFailure using the event kind and clears on a successful publish', () => {
  const source = readFileSync('app/room/[room]/components/shared/DevicePermissionNotice.tsx', 'utf8');
  assert.match(source, /onMediaError = \(reported: Error, kind\?: MediaDeviceKind\)/);
  assert.match(source, /MediaDeviceFailure\.getFailure\(error\)/);
  assert.match(source, /RoomEvent\.LocalTrackPublished/);
  assert.doesNotMatch(source, /new Set<BlockedDevice>\(\['camera', 'microphone'\]\)/);
});

test('diagnostics report per-interval deltas, not cumulative counters', () => {
  const { videoStatDeltas } = diagnostics();
  const first = videoStatDeltas(new Map(), [
    { type: 'codec', id: 'c1', mimeType: 'video/VP8' },
    { type: 'inbound-rtp', kind: 'video', id: 'in1', codecId: 'c1', framesDecoded: 100, framesDropped: 10, freezeCount: 2, pliCount: 1 },
  ]);
  const second = videoStatDeltas(first.next, [
    { type: 'inbound-rtp', kind: 'video', id: 'in1', framesDecoded: 130, framesDropped: 12, freezeCount: 2, pliCount: 1, firCount: 0 },
  ]);
  assert.equal(first.deltas[0].codec, 'video/VP8');
  assert.equal(second.deltas[0].decoded, 30);
  assert.equal(second.deltas[0].dropped, 2);
  assert.equal(second.deltas[0].freezes, 0);
  assert.equal(second.deltas[0].keyframeRequests, 0);
});

test('diagnostics are opt-in per page load and redact identifiers', () => {
  const { redactId } = diagnostics();
  assert.match(redactId('TR_abcdef123456'), /^#[0-9a-f]{6}$/);
  assert.notEqual(redactId('TR_a'), redactId('TR_b'));
  const shell = readFileSync('app/room/[room]/components/shared/RoomShell.tsx', 'utf8');
  assert.match(shell, /showMediaDiagnostics \? <MediaDiagnosticsPanel \/> : null/);
  const panel = readFileSync('app/room/[room]/components/shared/MediaDiagnosticsPanel.tsx', 'utf8');
  assert.match(panel, /get\('mediaDiagnostics'\) === '1'/);
  assert.match(panel, /`remote \$\{redactId\(identity\)\}`/, 'remote participants are labelled by a redacted id');
  assert.doesNotMatch(panel, /room\.name\b|\broomName\b|\.metadata\b|getToken|accessToken/, 'no room name, metadata or token reaches the export');
});

test('diagnostics distinguish a refresh or a dropped connection from a clean leave', () => {
  const panel = readFileSync('app/room/[room]/components/shared/MediaDiagnosticsPanel.tsx', 'utf8');
  assert.match(panel, /RoomEvent\.Disconnected\b/, 'the local disconnect is logged');
  assert.match(panel, /DisconnectReason\[arg\]/, 'with a readable reason, not a bare number');
  assert.match(panel, /navigation=\$\{navigation\}/, 'the page records whether it was reloaded');
  assert.match(panel, /'pagehide'/, 'leaving or refreshing the page is logged');
  assert.match(panel, /discarded=\$\{discarded\}/, 'a browser tab-discard reload is distinguished from a manual refresh');
});

test('call overlays stay below side panels so a panel close button is never covered', () => {
  const { ROOM_LAYERS } = loadModule('lib/ui/room-layers.ts');
  for (const overlay of ['callQuality', 'diagnostics', 'notice', 'errorToast']) {
    assert.ok(ROOM_LAYERS[overlay] > ROOM_LAYERS.controlBar && ROOM_LAYERS[overlay] < ROOM_LAYERS.sidePanel, overlay);
  }
  for (const [file, layer] of [
    ['app/room/[room]/components/shared/DevicePermissionNotice.tsx', 'notice'],
    ['app/room/[room]/doctor/components/shared/ErrorToast.tsx', 'errorToast'],
    ['app/room/[room]/components/shared/CallQualityMeter.tsx', 'callQuality'],
    ['app/room/[room]/components/shared/MediaDiagnosticsPanel.tsx', 'diagnostics'],
  ]) assert.match(readFileSync(file, 'utf8'), new RegExp(`zIndex: ROOM_LAYERS\\.${layer}`), file);
  assert.match(readFileSync('components/CollapsibleSidebar.tsx', 'utf8'), /SIDEBAR_Z_INDEX = ROOM_LAYERS\.sidePanel/);
});

test('render meter reports painted frames, the longest stall and blinks to black', () => {
  const { RenderMeter } = diagnostics();
  const meter = new RenderMeter();
  for (let index = 0; index < 30; index += 1) meter.frame(index * 33);
  meter.frame(30 * 33 + 400); // one 433 ms stall
  meter.luma(120); meter.luma(5); meter.luma(110); meter.luma(110);
  const interval = meter.take();
  assert.equal(interval.renderFps, 31);
  assert.equal(interval.maxGapMs, 433);
  assert.equal(interval.blackFlashes, 1, 'a lit-to-black sample counts once');
  const empty = meter.take();
  assert.equal(empty.renderFps, 0, 'intervals reset');
  assert.equal(empty.maxGapMs, null);
  assert.equal(empty.blackFlashes, 0);
  const panel = readFileSync('app/room/[room]/components/shared/MediaDiagnosticsPanel.tsx', 'utf8');
  assert.match(panel, /requestVideoFrameCallback/, 'painted frames are measured, not only decoded ones');
  assert.doesNotMatch(panel, /toDataURL|toBlob/, 'no image ever leaves the element; only a luminance number');
});

test('a camera pick that will not start restores the previous camera and reports it', async () => {
  const { makeDeviceSwitchRecoverable, DeviceSwitchError } = loadModule('lib/livekit/recoverable-device-switch.ts',
    { 'livekit-client': { RoomEvent: { MediaDevicesError: 'mediaDevicesError' } } }, { Error, Promise });
  const calls = [];
  const emitted = [];
  let active = 'usb-camera';
  const room = {
    getActiveDevice: () => active,
    async switchActiveDevice(kind, id) {
      calls.push(id);
      if (id === 'obs-virtual-camera') throw Object.assign(new Error('Could not start video source'), { name: 'NotReadableError' });
      active = id;
      return true;
    },
    emit: (...args) => emitted.push(args),
  };
  makeDeviceSwitchRecoverable(room);
  await assert.rejects(room.switchActiveDevice('videoinput', 'obs-virtual-camera'), /Could not start/);
  assert.deepEqual(calls, ['obs-virtual-camera', 'usb-camera'], 'falls back to the camera that worked');
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0][0], 'mediaDevicesError');
  assert.ok(emitted[0][1] instanceof DeviceSwitchError);
  assert.equal(emitted[0][1].restored, true);
  assert.equal(emitted[0][2], 'videoinput');
  assert.equal(await room.switchActiveDevice('videoinput', 'usb-camera'), true, 'a working pick passes through');
});

test('a failed device pick is described as kept, not blocked', () => {
  const text = problems().describeDeviceProblems({ camera: 'switch-failed' });
  assert.match(text, /camera is still the one you used before/);
  assert.match(text, /OBS/);
  assert.doesNotMatch(text, /blocked/);
  const wiring = readFileSync('lib/livekit/media-encryption-client.ts', 'utf8');
  assert.equal((wiring.match(/makeDeviceSwitchRecoverable\(room\)/g) || []).length, 2, 'both transport and E2EE rooms recover');
});

test('the in-call "Manage invitations" control looks and reads like a new-tab link', () => {
  const panel = readFileSync('app/room/[room]/doctor/components/DoctorControlsPanel.tsx', 'utf8');
  assert.match(panel, /textDecoration: 'underline'/);
  assert.match(panel, /\(opens in a new tab\)/);
});

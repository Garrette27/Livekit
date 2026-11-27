import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const record = { exports: {} };
runInNewContext(ts.transpileModule(readFileSync('lib/livekit/call-quality.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: record, exports: record.exports, Math, Number });
const { summarizeCallStats } = record.exports;

test('call-quality summary reports receiver numbers from WebRTC stats', () => {
  const sample = summarizeCallStats([
    { type: 'candidate-pair', state: 'succeeded', nominated: true, currentRoundTripTime: 0.042 },
    { type: 'inbound-rtp', kind: 'video', frameWidth: 1280, frameHeight: 720, framesPerSecond: 29.6, packetsLost: 2, packetsReceived: 998, jitter: 0.012 },
    { type: 'inbound-rtp', kind: 'audio', packetsLost: 0, packetsReceived: 1000, jitter: 0.004 },
    { type: 'outbound-rtp', kind: 'video', frameWidth: 640, frameHeight: 360, framesPerSecond: 24 },
  ]);
  assert.equal(sample.roundTripMs, 42);
  assert.equal(sample.jitterMs, 12);
  assert.equal(sample.packetLossPercent, 0.1);
  assert.deepEqual({ ...sample.receivedVideo }, { width: 1280, height: 720, fps: 30 });
  assert.deepEqual({ ...sample.sentVideo }, { width: 640, height: 360, fps: 24 });
});

test('missing stats stay null instead of becoming a guessed value', () => {
  const sample = summarizeCallStats([]);
  assert.equal(sample.roundTripMs, null);
  assert.equal(sample.packetLossPercent, null);
  assert.equal(sample.receivedVideo, null);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadAppointmentModule as loadModule } from './appointment-regressions.test.mjs';

const evidence = () => loadModule('lib/ai/consultation-evidence.ts', {}, { Map, Set, Number, Array, Math });
// Synthetic consultation text only; no real patient speech.
const consultation = [
  '[Doctor] Good afternoon, what brings you to the clinic today?',
  '[Patient] Masakit po ang ulo ko since kahapon at may lagnat po ako.',
  '[Doctor] Did you take any medicine for the fever and the headache?',
  '[Patient] Uminom po ako ng paracetamol kaninang umaga.',
];

test('a clear two-party consultation is usable evidence', () => {
  const result = evidence().prepareTranscriptEvidence(consultation);
  assert.equal(result.quality, 'usable');
  assert.equal(result.reason, 'none');
  assert.equal(result.crosstalkLineCount, 0);
});

test('mostly unclear audio (music, TV) abstains instead of summarizing what remains', () => {
  const result = evidence().prepareTranscriptEvidence(consultation, { unclearSegmentCount: 6 });
  assert.equal(result.quality, 'insufficient');
  assert.equal(result.reason, 'unclear_audio');
  assert.equal(result.unclearSegmentCount, 6);
});

test('a few unclear segments do not block an otherwise clear consultation', () => {
  const result = evidence().prepareTranscriptEvidence(consultation, { unclearSegmentCount: 1 });
  assert.equal(result.quality, 'usable');
});

test('only one side speaking (e.g. song lyrics on one open microphone) abstains', () => {
  const lyrics = [
    '[Doctor] Ikaw lang ang mamahalin ko hanggang sa dulo ng walang hanggan',
    '[Doctor] Sa bawat sandali ikaw ang nasa isip at puso ko',
    '[Patient] Opo.',
  ];
  const result = evidence().prepareTranscriptEvidence(lyrics);
  assert.equal(result.quality, 'insufficient');
  assert.equal(result.reason, 'one_sided_capture');
});

test('the same speech captured by both microphones is kept once', () => {
  const echoed = [
    consultation[0],
    '[Patient] Good afternoon, what brings you to the clinic today?',
    ...consultation.slice(1),
    '[Doctor] Uminom po ako ng paracetamol kaninang umaga',
  ];
  const result = evidence().prepareTranscriptEvidence(echoed);
  assert.equal(result.crosstalkLineCount, 2);
  assert.deepEqual([...result.lines], consultation);
  assert.equal(result.quality, 'usable');
});

test('unlabelled browser speech notes are not subject to the two-party rule', () => {
  const notes = ['[doctor-device-stt] 2026-11-28T07:25:00.000Z: patient reports headache since yesterday with mild fever and took paracetamol this morning'];
  const result = evidence().prepareTranscriptEvidence(notes);
  assert.notEqual(result.reason, 'one_sided_capture');
});

test('the recognition-confidence floor follows the Whisper -1.0 log-probability convention', () => {
  const { isClearSpeech, SPEECH_LOGPROB_FLOOR } = evidence();
  assert.equal(SPEECH_LOGPROB_FLOOR, -1);
  assert.equal(isClearSpeech(-0.2), true);
  assert.equal(isClearSpeech(-1.4), false);
  assert.equal(isClearSpeech(null), true, 'legacy segments without confidence stay usable');
});

test('token log-probabilities are averaged; missing or malformed values report null', () => {
  const { meanLogprob } = loadModule('lib/services/transcription/openai-audio-transcriber.ts', {}, { Number, Array });
  assert.equal(meanLogprob([{ logprob: -0.5 }, { logprob: -1.5 }]), -1);
  assert.equal(meanLogprob(undefined), null);
  assert.equal(meanLogprob([{ logprob: 'x' }]), null);
});

test('wiring: confidence is requested and stored, and unclear segments never fall back to the legacy buffer', () => {
  const transcriber = readFileSync('lib/services/transcription/openai-audio-transcriber.ts', 'utf8');
  assert.match(transcriber, /include\[\]', 'logprobs'/);
  assert.match(transcriber, /leave out background music, song lyrics/);
  const repository = readFileSync('lib/repositories/consultation-transcript-repository.ts', 'utf8');
  assert.match(repository, /meanTokenLogprob: input\.meanTokenLogprob/);
  assert.match(repository, /isClearSpeech\(/);
  const generator = readFileSync('lib/services/consultation-finalization/summary-generator.ts', 'utf8');
  assert.match(generator, /hasSessionTranscript = sessionTranscript\.segmentCount > 0/);
  assert.match(generator, /unclearSegmentCount: hasSessionTranscript/);
});

test('the active-speaker ring that blinked with background audio is not drawn over video', () => {
  const styles = readFileSync('app/room/[room]/components/shared/LiveKitStyles.tsx', 'utf8');
  assert.match(styles, /\.lk-participant-tile::after \{\s*content: none !important;/);
});

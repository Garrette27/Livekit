import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadAppointmentModule as loadModule } from './appointment-regressions.test.mjs';

const verifier = () => loadModule('lib/ai/claim-verification.ts', {}, { Map, Set, Number, Array });
// Synthetic transcript; no real patient speech.
const transcript = [
  '[Doctor] Good afternoon, how are you feeling today?',
  '[Patient] masama po pakiramdam ko, medyo malala na yung sakit ng ulo',
  '[Doctor] Take paracetamol 500 mg and come back in three days.',
  '[doctor-device-stt] 2026-11-28T07:25:00.000Z: may lagnat po ako since kahapon',
];

test('a disease the transcript never contains is dropped even when the model cites a real line', () => {
  const { numberTranscriptLines, assembleVerifiedSummary } = verifier();
  const lines = numberTranscriptLines(transcript);
  const result = assembleVerifiedSummary({
    summarySentences: [
      { text: 'Patient reported having malaria.', speaker: 'patient', kind: 'condition_or_diagnosis', term: 'malaria', evidence: [{ line: 2, quote: 'malaria' }] },
      { text: 'Patient said the headache is getting worse.', speaker: 'patient', kind: 'symptom', term: '', evidence: [{ line: 2, quote: 'malala na yung sakit ng ulo' }] },
    ],
    keyPoints: [
      // The real failure mode: a genuine quote ("malala", serious) rendered as a named condition.
      { text: 'Patient has malaria.', speaker: 'patient', kind: 'condition_or_diagnosis', term: 'malaria', evidence: [{ line: 2, quote: 'malala' }, { line: 9, quote: 'malaria' }] },
      { text: 'Patient said the headache is getting worse.', speaker: 'patient', kind: 'symptom', term: '', evidence: [{ line: 2, quote: 'malala na' }] },
    ],
    recommendations: [], followUpActions: [], riskLevel: 'High', category: 'Primary Care',
  }, lines);
  assert.ok(result);
  assert.doesNotMatch(result.summary, /malaria/i, 'the unsupported sentence must not reach the narrative');
  assert.match(result.summary, /headache is getting worse/);
  assert.ok(!result.keyPoints.some((point) => /malaria/i.test(point)), 'a condition name must appear verbatim in its quote');
  assert.deepEqual([...result.keyPoints], ['Patient said the headache is getting worse.']);
  assert.equal(result.verification.dropped, 2);
});

test('quotes must match whole words in the cited line, from a speaker that does not contradict the claim', () => {
  const { numberTranscriptLines, verifyClaims } = verifier();
  const lines = numberTranscriptLines(transcript);
  const partialWord = verifyClaims('keyPoints', [{ text: 'x', speaker: 'patient', kind: 'other', term: '', evidence: [{ line: 2, quote: 'mala' }] }], lines);
  assert.equal(partialWord.verified.length, 0);
  const wrongSpeaker = verifyClaims('keyPoints', [{ text: 'Patient was told to take paracetamol.', speaker: 'patient', kind: 'medication', term: 'paracetamol', evidence: [{ line: 3, quote: 'paracetamol 500 mg' }] }], lines);
  assert.equal(wrongSpeaker.verified.length, 0);
  const caseAndPunctuation = verifyClaims('keyPoints', [{ text: 'Doctor advised paracetamol.', speaker: 'doctor', kind: 'medication', term: 'Paracetamol', evidence: [{ line: 3, quote: 'Paracetamol, 500 MG' }] }], lines);
  assert.equal(caseAndPunctuation.verified.length, 1);
  const unlabelled = verifyClaims('keyPoints', [{ text: 'Patient said they have had a fever since yesterday.', speaker: 'patient', kind: 'symptom', term: '', evidence: [{ line: 4, quote: 'may lagnat po ako' }] }], lines);
  assert.equal(unlabelled.verified[0].speakerUnconfirmed, true);
});

test('recommendations need the doctor’s words, and nothing verified means no AI draft', () => {
  const { numberTranscriptLines, assembleVerifiedSummary } = verifier();
  const lines = numberTranscriptLines(transcript);
  const result = assembleVerifiedSummary({
    summarySentences: [{ text: 'Patient said they feel unwell.', speaker: 'patient', kind: 'symptom', term: '', evidence: [{ line: 2, quote: 'masama po pakiramdam ko' }] }],
    keyPoints: [],
    recommendations: [
      { text: 'Rest at home.', speaker: 'patient', kind: 'other', term: '', evidence: [{ line: 2, quote: 'masama' }] },
      { text: 'Take paracetamol 500 mg.', speaker: 'doctor', kind: 'medication', term: 'paracetamol', evidence: [{ line: 3, quote: 'Take paracetamol 500 mg' }] },
      { text: 'Take ibuprofen.', speaker: 'doctor', kind: 'medication', term: 'ibuprofen', evidence: [{ line: 3, quote: 'Take paracetamol 500 mg' }] },
    ],
    followUpActions: [], riskLevel: 'High', category: 'Primary Care',
  }, lines);
  assert.deepEqual([...result.recommendations], ['Take paracetamol 500 mg.']);
  assert.equal(result.riskLevel, 'Unknown', 'risk needs at least one verified key point');
  assert.equal(assembleVerifiedSummary({ summarySentences: [{ text: 'Malaria.', speaker: 'patient', kind: 'condition_or_diagnosis', term: 'malaria', evidence: [{ line: 2, quote: 'malaria' }] }], keyPoints: [], recommendations: [], followUpActions: [], riskLevel: 'Unknown', category: 'Primary Care' }, lines), null);
});

test('the generator verifies before storing and falls back to the deterministic record', () => {
  const source = readFileSync('lib/services/consultation-finalization/summary-generator.ts', 'utf8');
  assert.match(source, /summarySentences: EVIDENCE_LINKED_CLAIMS/);
  assert.match(source, /required: \['text', 'speaker', 'kind', 'term', 'evidence'\]/);
  assert.match(source, /assembleVerifiedSummary\(/);
  assert.match(source, /buildInsufficientEvidenceContent\(transcriptEvidence, 'no_verifiable_claims'\)/);
  assert.match(source, /claimEvidence: verified\.claims/);
  assert.match(source, /formatNumberedLines\(numberTranscriptLines\(transcriptEvidence\.lines\)\)/);
});

test('stored evidence is parsed defensively and legacy summaries project no sources', () => {
  const { parseStoredClaims } = verifier();
  assert.deepEqual([...parseStoredClaims(undefined)], []);
  assert.equal(parseStoredClaims([{ section: 'keyPoints', text: 'x', speaker: 'patient', sources: [] }]).length, 0);
  assert.equal(parseStoredClaims([{ section: 'keyPoints', text: 'x', speaker: 'patient', sources: [{ line: 1, speaker: 'patient', quote: 'hello there' }] }]).length, 1);
});

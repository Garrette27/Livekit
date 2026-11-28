export type TranscriptEvidenceQuality = 'usable' | 'limited' | 'insufficient';

export type TranscriptEvidenceReason =
  | 'none'
  | 'no_transcript'
  | 'too_little_speech'
  | 'highly_repetitive_capture'
  | 'partially_repetitive_capture'
  | 'unclear_audio'
  | 'one_sided_capture';

/**
 * Recognition-confidence floor, as a mean token log-probability. -1.0 is the
 * log-probability threshold OpenAI Whisper's own decoder uses to reject a
 * segment as unreliable (`logprob_threshold`); speech heard clearly scores
 * near 0, while song lyrics, TV and the other person's voice leaking into a
 * microphone score lower.
 */
export const SPEECH_LOGPROB_FLOOR = -1.0;

/** True when a segment may be used as evidence. Unknown confidence (legacy rows, whisper-1) counts as clear. */
export function isClearSpeech(meanTokenLogprob: number | null | undefined): boolean {
  return typeof meanTokenLogprob !== 'number' || !Number.isFinite(meanTokenLogprob)
    || meanTokenLogprob >= SPEECH_LOGPROB_FLOOR;
}

/** Share of recognized segments that may be unclear before the record abstains. */
const MAX_UNCLEAR_SEGMENT_SHARE = 0.5;
/** Words each party must contribute before a two-person consultation can be summarized. */
const MIN_WORDS_PER_PARTY = 8;
/** How many preceding lines are compared when looking for the same speech on both microphones. */
const CROSSTALK_WINDOW_LINES = 3;
const CROSSTALK_SIMILARITY = 0.6;

/**
 * The transcript representation trusted by summary generation. It hides raw
 * browser-recognition quirks (timestamp formats, cumulative result replay, and
 * unbounded buffers) from the model-facing code and carries an explicit signal
 * when the remaining evidence is too weak to summarize safely.
 */
export interface PreparedTranscriptEvidence {
  lines: string[];
  sourceLineCount: number;
  uniqueLineCount: number;
  wordCount: number;
  duplicateRate: number;
  /** Lines removed because the other participant's microphone captured the same speech. */
  crosstalkLineCount: number;
  /** Recognized segments excluded before this step for low recognition confidence. */
  unclearSegmentCount: number;
  quality: TranscriptEvidenceQuality;
  reason: TranscriptEvidenceReason;
  wasTruncated: boolean;
}

const MAX_EVIDENCE_LINES = 1_000;
const MAX_LINE_CHARACTERS = 2_000;
const ISO_TIMESTAMP_PREFIX = /^\[?\(?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\)?\]?\s*:?\s*/i;

function normalizeTranscriptLine(value: string): string {
  return value
    .replace(ISO_TIMESTAMP_PREFIX, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LINE_CHARACTERS);
}

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const SPEAKER_PREFIX = /^\[(doctor|patient)\]\s*/i;

function wordsOf(line: string): string[] {
  return (line.replace(SPEAKER_PREFIX, '').match(WORD) || []).map((word) => word.toLocaleLowerCase('en'));
}

function countWords(lines: string[]): number {
  return lines.reduce((total, line) => total + wordsOf(line).length, 0);
}

function speakerOf(line: string): 'doctor' | 'patient' | null {
  const match = SPEAKER_PREFIX.exec(line);
  return match ? (match[1].toLowerCase() as 'doctor' | 'patient') : null;
}

/** Overlap of the shorter line's words with the longer one's (0..1). */
function wordOverlap(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  const pool = new Set(longer);
  return shorter.filter((word) => pool.has(word)).length / shorter.length;
}

/**
 * Drops a line when a nearby line from the OTHER speaker says the same thing.
 * With both people in one room (or speakers audible to the other microphone)
 * each sentence is transcribed twice, once under the wrong name. The first
 * capture is kept; which of the two was the real speaker cannot be known, so
 * a statement attributed this way is still checked by the clinician.
 */
function removeCrosstalk(lines: string[]): { kept: string[]; removed: number } {
  const kept: string[] = [];
  let removed = 0;
  for (const line of lines) {
    const speaker = speakerOf(line);
    const words = wordsOf(line);
    const echoed = speaker !== null && words.length >= 2 && kept.slice(-CROSSTALK_WINDOW_LINES).some((previous) => {
      const previousSpeaker = speakerOf(previous);
      return previousSpeaker !== null && previousSpeaker !== speaker
        && wordOverlap(words, wordsOf(previous)) >= CROSSTALK_SIMILARITY;
    });
    if (echoed) removed += 1; else kept.push(line);
  }
  return { kept, removed };
}

/**
 * Converts raw speech-recognition entries into bounded, de-duplicated evidence
 * and classifies whether an abstractive clinical summary is supportable. Exact
 * duplicates are removed globally because Web Speech result events are
 * cumulative; replayed entries are transport noise, not repeated statements.
 *
 * The classification is a selective-prediction ("abstain when unsure") gate:
 * the record abstains, with a fixed non-clinical text, when most recognized
 * audio was unclear (`unclearSegmentCount`, segments already excluded by
 * isClearSpeech), or when speaker-labelled evidence lacks either the doctor or
 * the patient. A consultation summary needs both sides of the conversation; a
 * one-sided transcript is usually background audio or a single open mic.
 */
export function prepareTranscriptEvidence(
  transcriptionData: string[] | null | undefined,
  { unclearSegmentCount = 0 }: { unclearSegmentCount?: number } = {}
): PreparedTranscriptEvidence {
  const sourceLines = (transcriptionData || [])
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const uniqueLines: string[] = [];
  const seenText = new Set<string>();

  for (const sourceLine of sourceLines) {
    const normalizedLine = normalizeTranscriptLine(sourceLine);
    if (!normalizedLine) {
      continue;
    }

    const identity = normalizedLine.toLocaleLowerCase('en');
    if (seenText.has(identity)) {
      continue;
    }

    seenText.add(identity);
    uniqueLines.push(normalizedLine);
  }

  const { kept: distinctLines, removed: crosstalkLineCount } = removeCrosstalk(uniqueLines);
  const lines = distinctLines.slice(0, MAX_EVIDENCE_LINES);
  const sourceLineCount = sourceLines.length;
  const uniqueLineCount = uniqueLines.length;
  const duplicateRate = sourceLineCount > 0
    ? Math.max(0, 1 - (uniqueLineCount / sourceLineCount))
    : 0;
  const wordCount = countWords(lines);
  const unclear = Math.max(0, Math.floor(unclearSegmentCount));
  const unclearShare = unclear > 0 ? unclear / (unclear + sourceLineCount) : 0;
  const labelled = lines.some((line) => speakerOf(line) !== null);
  const wordsBy = (speaker: 'doctor' | 'patient') =>
    countWords(lines.filter((line) => speakerOf(line) === speaker));
  const oneSided = labelled
    && (wordsBy('doctor') < MIN_WORDS_PER_PARTY || wordsBy('patient') < MIN_WORDS_PER_PARTY);

  let quality: TranscriptEvidenceQuality = 'usable';
  let reason: TranscriptEvidenceReason = 'none';

  if (unclear > 0 && unclearShare >= MAX_UNCLEAR_SEGMENT_SHARE) {
    quality = 'insufficient';
    reason = 'unclear_audio';
  } else if (sourceLineCount === 0 || uniqueLineCount === 0) {
    quality = 'insufficient';
    reason = 'no_transcript';
  } else if (sourceLineCount >= 20 && duplicateRate >= 0.8) {
    quality = 'insufficient';
    reason = 'highly_repetitive_capture';
  } else if (wordCount < 12) {
    quality = 'insufficient';
    reason = 'too_little_speech';
  } else if (oneSided) {
    quality = 'insufficient';
    reason = 'one_sided_capture';
  } else if (duplicateRate >= 0.35 || wordCount < 30) {
    quality = 'limited';
    reason = duplicateRate >= 0.35
      ? 'partially_repetitive_capture'
      : 'too_little_speech';
  }

  return {
    lines,
    sourceLineCount,
    uniqueLineCount,
    wordCount,
    duplicateRate,
    crosstalkLineCount,
    unclearSegmentCount: unclear,
    quality,
    reason,
    wasTruncated: distinctLines.length > lines.length,
  };
}

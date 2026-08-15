export type TranscriptEvidenceQuality = 'usable' | 'limited' | 'insufficient';

export type TranscriptEvidenceReason =
  | 'none'
  | 'no_transcript'
  | 'too_little_speech'
  | 'highly_repetitive_capture'
  | 'partially_repetitive_capture';

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

function countWords(lines: string[]): number {
  return lines.reduce((total, line) => {
    const words = line.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
    return total + (words?.length || 0);
  }, 0);
}

/**
 * Converts raw speech-recognition entries into bounded, de-duplicated evidence
 * and classifies whether an abstractive clinical summary is supportable. Exact
 * duplicates are removed globally because Web Speech result events are
 * cumulative; replayed entries are transport noise, not repeated statements.
 */
export function prepareTranscriptEvidence(
  transcriptionData: string[] | null | undefined
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

  const lines = uniqueLines.slice(0, MAX_EVIDENCE_LINES);
  const sourceLineCount = sourceLines.length;
  const uniqueLineCount = uniqueLines.length;
  const duplicateRate = sourceLineCount > 0
    ? Math.max(0, 1 - (uniqueLineCount / sourceLineCount))
    : 0;
  const wordCount = countWords(lines);

  let quality: TranscriptEvidenceQuality = 'usable';
  let reason: TranscriptEvidenceReason = 'none';

  if (sourceLineCount === 0 || uniqueLineCount === 0) {
    quality = 'insufficient';
    reason = 'no_transcript';
  } else if (sourceLineCount >= 20 && duplicateRate >= 0.8) {
    quality = 'insufficient';
    reason = 'highly_repetitive_capture';
  } else if (wordCount < 12) {
    quality = 'insufficient';
    reason = 'too_little_speech';
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
    quality,
    reason,
    wasTruncated: uniqueLineCount > lines.length,
  };
}

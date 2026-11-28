/**
 * Evidence-linked summary claims ("linked evidence" pattern used by clinical
 * ambient-documentation tools): every statement the model proposes must cite
 * numbered transcript lines and quote them verbatim. This module verifies
 * those citations deterministically, without trusting the model:
 *
 * - the cited line must exist;
 * - the quote must occur in that line (case, spacing and punctuation
 *   insensitive) and be at least MIN_QUOTE_CHARACTERS long;
 * - the line's speaker must not contradict the claim's speaker (a claim about
 *   what the patient said cannot rest on a "[Doctor]" line, and vice versa);
 *   lines without a speaker label (browser speech notes) may support either,
 *   but the claim is then marked `speakerUnconfirmed`.
 *
 * A claim with no verified citation is dropped. Verification proves only that
 * the words were in the recognized transcript, not that speech recognition
 * heard them correctly; the clinician sees each claim next to its quote.
 */

export type TranscriptSpeaker = 'doctor' | 'patient' | 'unlabelled';
export type ClaimSpeaker = 'doctor' | 'patient';
export type ClaimSection = 'summary' | 'keyPoints' | 'recommendations' | 'followUpActions';
/**
 * What a claim asserts. Named entities (a condition or diagnosis, a medication,
 * a test or measurement) are high-stakes: their `term` may never be a
 * translation or correction and must appear verbatim in a verified quote.
 */
export type ClaimKind = 'condition_or_diagnosis' | 'medication' | 'test_or_measurement' | 'symptom' | 'other';
const VERBATIM_KINDS = new Set<ClaimKind>(['condition_or_diagnosis', 'medication', 'test_or_measurement']);
const CLAIM_KINDS = new Set<ClaimKind>([...VERBATIM_KINDS, 'symptom', 'other']);

export interface NumberedTranscriptLine {
  /** 1-based number shown to the model as `L<number>`. */
  number: number;
  speaker: TranscriptSpeaker;
  /** Spoken text without the speaker/source label. */
  text: string;
}

export interface ProposedClaim {
  text: string;
  speaker: ClaimSpeaker;
  kind: ClaimKind;
  /** The named entity for verbatim kinds, exactly as spoken; '' otherwise. */
  term: string;
  evidence: Array<{ line: number; quote: string }>;
}

export interface VerifiedClaim {
  section: ClaimSection;
  text: string;
  speaker: ClaimSpeaker;
  kind: ClaimKind;
  speakerUnconfirmed: boolean;
  sources: Array<{ line: number; speaker: TranscriptSpeaker; quote: string }>;
}

export interface ClaimVerificationResult {
  verified: VerifiedClaim[];
  proposedCount: number;
  droppedCount: number;
}

export const MIN_QUOTE_CHARACTERS = 3;
const MAX_QUOTE_CHARACTERS = 300;
const MAX_SOURCES_PER_CLAIM = 3;

const SPEAKER_LABEL = /^\[(doctor|patient)\]\s*/i;
const DEVICE_STT_LABEL = /^\[[a-z-]*stt\]\s*(?:\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*:?\s*)?/i;

/** Parse prepared evidence lines into numbered, speaker-labelled lines. */
export function numberTranscriptLines(lines: string[]): NumberedTranscriptLine[] {
  return lines.map((raw, index) => {
    const labelled = SPEAKER_LABEL.exec(raw);
    if (labelled) {
      return { number: index + 1, speaker: labelled[1].toLowerCase() as TranscriptSpeaker, text: raw.slice(labelled[0].length).trim() };
    }
    return { number: index + 1, speaker: 'unlabelled', text: raw.replace(DEVICE_STT_LABEL, '').trim() };
  });
}

/** Render numbered lines for the model: `L3 [Patient] text`. */
export function formatNumberedLines(lines: NumberedTranscriptLine[]): string[] {
  const label = { doctor: '[Doctor]', patient: '[Patient]', unlabelled: '[Speaker not identified]' } as const;
  return lines.map((line) => `L${line.number} ${label[line.speaker]} ${line.text}`);
}

/** Comparison form: lower case, letters/digits only, single spaces. */
export function normalizeForMatch(value: string): string {
  return value
    .toLocaleLowerCase('en')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** True when `normalizedWords` occurs in `value` as whole words. */
function containsWords(value: string, normalizedWords: string): boolean {
  return ` ${normalizeForMatch(value)} `.includes(` ${normalizedWords} `);
}

/** Verify one section's proposed claims against the numbered transcript. */
export function verifyClaims(
  section: ClaimSection,
  proposed: unknown,
  lines: NumberedTranscriptLine[]
): ClaimVerificationResult {
  const claims = Array.isArray(proposed) ? proposed : [];
  const byNumber = new Map(lines.map((line) => [line.number, line]));
  const verified: VerifiedClaim[] = [];
  for (const raw of claims) {
    const claim = raw as Partial<ProposedClaim> | null;
    const text = typeof claim?.text === 'string' ? claim.text.trim() : '';
    const speaker = claim?.speaker === 'doctor' || claim?.speaker === 'patient' ? claim.speaker : null;
    const kind: ClaimKind = CLAIM_KINDS.has(claim?.kind as ClaimKind) ? claim!.kind as ClaimKind : 'other';
    const term = normalizeForMatch(typeof claim?.term === 'string' ? claim.term : '');
    if (!text || !speaker || !Array.isArray(claim?.evidence)) continue;
    if (VERBATIM_KINDS.has(kind) && (term.length < MIN_QUOTE_CHARACTERS || !containsWords(text, term))) continue;
    const sources: VerifiedClaim['sources'] = [];
    for (const item of claim.evidence) {
      const line = byNumber.get(Number(item?.line));
      const quote = typeof item?.quote === 'string' ? item.quote.trim().slice(0, MAX_QUOTE_CHARACTERS) : '';
      const normalizedQuote = normalizeForMatch(quote);
      if (!line || normalizedQuote.length < MIN_QUOTE_CHARACTERS) continue;
      if (!` ${normalizeForMatch(line.text)} `.includes(` ${normalizedQuote} `)) continue;
      if (line.speaker !== 'unlabelled' && line.speaker !== speaker) continue;
      if (sources.some((source) => source.line === line.number && source.quote === quote)) continue;
      sources.push({ line: line.number, speaker: line.speaker, quote });
      if (sources.length >= MAX_SOURCES_PER_CLAIM) break;
    }
    if (!sources.length) continue;
    if (VERBATIM_KINDS.has(kind) && !sources.some((source) => containsWords(source.quote, term))) continue;
    verified.push({ section, text, speaker, kind, speakerUnconfirmed: sources.every((source) => source.speaker === 'unlabelled'), sources });
  }
  return { verified, proposedCount: claims.length, droppedCount: claims.length - verified.length };
}

export interface VerifiedSummary {
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  followUpActions: string[];
  riskLevel: 'Unknown' | 'Low' | 'Medium' | 'High';
  category: string;
  claims: VerifiedClaim[];
  verification: { proposed: number; verified: number; dropped: number };
}

const RISK_LEVELS = new Set(['Unknown', 'Low', 'Medium', 'High']);
const CATEGORIES = new Set(['Primary Care', 'Specialist', 'Emergency', 'Follow-up', 'General Consultation']);

/**
 * Turn the model's evidence-linked JSON into the stored summary, keeping only
 * verified claims. Recommendations and follow-up actions must rest on the
 * doctor's words. The narrative is rebuilt from verified summary sentences, so
 * prose cannot carry a claim the citations do not support. Returns null when
 * nothing verifies; the caller stores the deterministic insufficient-evidence
 * record instead of an unsupported draft. Risk stays `Unknown` unless at least
 * one clinical claim verified.
 */
export function assembleVerifiedSummary(model: unknown, lines: NumberedTranscriptLine[]): VerifiedSummary | null {
  if (!model || typeof model !== 'object') throw new Error('Summary response is not an object');
  const value = model as Record<string, unknown>;
  const sections = {
    summary: verifyClaims('summary', value.summarySentences, lines),
    keyPoints: verifyClaims('keyPoints', value.keyPoints, lines),
    recommendations: verifyClaims('recommendations', value.recommendations, lines),
    followUpActions: verifyClaims('followUpActions', value.followUpActions, lines),
  };
  const doctorOnly = (claims: VerifiedClaim[]) => claims.filter((claim) => claim.speaker === 'doctor');
  const keep = {
    summary: sections.summary.verified.slice(0, 6),
    keyPoints: sections.keyPoints.verified.slice(0, 8),
    recommendations: doctorOnly(sections.recommendations.verified).slice(0, 6),
    followUpActions: doctorOnly(sections.followUpActions.verified).slice(0, 6),
  };
  const claims = [...keep.summary, ...keep.keyPoints, ...keep.recommendations, ...keep.followUpActions];
  const proposed = Object.values(sections).reduce((total, section) => total + section.proposedCount, 0);
  if (!keep.summary.length && !keep.keyPoints.length) return null;
  const risk = typeof value.riskLevel === 'string' && RISK_LEVELS.has(value.riskLevel) ? value.riskLevel as VerifiedSummary['riskLevel'] : 'Unknown';
  return {
    summary: (keep.summary.length ? keep.summary : keep.keyPoints).map((claim) => claim.text.replace(/\s*$/, '')).join(' '),
    keyPoints: keep.keyPoints.map((claim) => claim.text),
    recommendations: keep.recommendations.map((claim) => claim.text),
    followUpActions: keep.followUpActions.map((claim) => claim.text),
    riskLevel: keep.keyPoints.length ? risk : 'Unknown',
    category: typeof value.category === 'string' && CATEGORIES.has(value.category) ? value.category : 'General Consultation',
    claims,
    verification: { proposed, verified: claims.length, dropped: proposed - claims.length },
  };
}

/** Read stored claim evidence defensively; legacy summaries have none and project as []. */
export function parseStoredClaims(value: unknown): VerifiedClaim[] {
  if (!Array.isArray(value)) return [];
  const sections = new Set<ClaimSection>(['summary', 'keyPoints', 'recommendations', 'followUpActions']);
  const claims: VerifiedClaim[] = [];
  for (const raw of value.slice(0, 32)) {
    const item = raw as Partial<VerifiedClaim> | null;
    if (!item || typeof item.text !== 'string' || !sections.has(item.section as ClaimSection) || !Array.isArray(item.sources)) continue;
    const sources = item.sources
      .filter((source) => source && Number.isInteger(source.line) && typeof source.quote === 'string')
      .slice(0, MAX_SOURCES_PER_CLAIM)
      .map((source) => ({
        line: source.line,
        speaker: (['doctor', 'patient', 'unlabelled'] as const).includes(source.speaker) ? source.speaker : 'unlabelled' as const,
        quote: source.quote.slice(0, MAX_QUOTE_CHARACTERS),
      }));
    if (!sources.length) continue;
    claims.push({
      section: item.section as ClaimSection,
      text: item.text,
      speaker: item.speaker === 'doctor' ? 'doctor' : 'patient',
      kind: CLAIM_KINDS.has(item.kind as ClaimKind) ? item.kind as ClaimKind : 'other',
      speakerUnconfirmed: item.speakerUnconfirmed === true,
      sources,
    });
  }
  return claims;
}

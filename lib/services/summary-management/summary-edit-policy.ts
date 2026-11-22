/**
 * Validation for clinician edits to a consultation summary. Dependency-free so
 * the rules are testable in isolation and cannot drift between callers.
 *
 * The editor is already the summary's owner; these bounds exist so a buggy or
 * hostile client cannot write wrong-typed or oversized values into a clinical
 * record (and toward Firestore's 1 MiB document limit). Unknown shapes are
 * rejected, not coerced.
 */
import type { SummaryEditableFields } from './contracts';

const MAX_SUMMARY_LENGTH = 20000;
const MAX_LIST_ITEMS = 50;
const MAX_LIST_ITEM_LENGTH = 2000;
const MAX_LABEL_LENGTH = 100;
/** Edit-history entries kept on a summary; older entries are dropped. */
export const MAX_SUMMARY_EDIT_HISTORY = 50;

export type SummaryEditValidation =
  | { ok: true; fields: SummaryEditableFields }
  | { ok: false; message: string };

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max;
}

function isBoundedList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_LIST_ITEMS &&
    value.every((item) => isBoundedString(item, MAX_LIST_ITEM_LENGTH))
  );
}

/** A Firestore document id the client may name: non-empty, no path separator. */
export function isSafeSummaryId(summaryId: unknown): summaryId is string {
  return (
    typeof summaryId === 'string' &&
    summaryId.trim().length > 0 &&
    summaryId.length <= 256 &&
    !summaryId.includes('/')
  );
}

/** Accepts only the editable fields that are present and correctly bounded. */
export function validateSummaryEdit(input: Record<string, unknown>): SummaryEditValidation {
  const fields: SummaryEditableFields = {};
  const checks: Array<[keyof SummaryEditableFields, (value: unknown) => boolean, string]> = [
    ['summary', (v) => isBoundedString(v, MAX_SUMMARY_LENGTH), `summary must be text up to ${MAX_SUMMARY_LENGTH} characters`],
    ['keyPoints', isBoundedList, `keyPoints must be up to ${MAX_LIST_ITEMS} short text items`],
    ['recommendations', isBoundedList, `recommendations must be up to ${MAX_LIST_ITEMS} short text items`],
    ['followUpActions', isBoundedList, `followUpActions must be up to ${MAX_LIST_ITEMS} short text items`],
    ['riskLevel', (v) => isBoundedString(v, MAX_LABEL_LENGTH), 'riskLevel must be a short label'],
    ['category', (v) => isBoundedString(v, MAX_LABEL_LENGTH), 'category must be a short label'],
  ];
  for (const [key, isValid, message] of checks) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }
    if (!isValid(value)) {
      return { ok: false, message };
    }
    (fields as Record<string, unknown>)[key] = value;
  }
  return { ok: true, fields };
}

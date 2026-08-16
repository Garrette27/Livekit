interface FirestoreTimestampShape {
  seconds?: number;
  nanoseconds?: number;
  _seconds?: number;
  _nanoseconds?: number;
}

interface DateLike {
  toDate?: () => Date;
  toMillis?: () => number;
}

/**
 * Converts the date representations used across Firestore Admin, the Firebase
 * browser SDK, and JSON transport into one Date. Keeping this compatibility in
 * one place prevents a serialized Firestore timestamp from silently becoming
 * "Unknown" in the UI.
 */
export function dateValueToDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'object') {
    const dateLike = value as DateLike;
    if (typeof dateLike.toDate === 'function') {
      const date = dateLike.toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof dateLike.toMillis === 'function') {
      const date = new Date(dateLike.toMillis());
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const timestamp = value as FirestoreTimestampShape;
    const seconds = timestamp.seconds ?? timestamp._seconds;
    const nanoseconds = timestamp.nanoseconds ?? timestamp._nanoseconds ?? 0;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      const date = new Date(seconds * 1000 + nanoseconds / 1_000_000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Stable JSON representation for an optional Firestore timestamp. */
export function dateValueToIso(value: unknown): string | null {
  return dateValueToDate(value)?.toISOString() ?? null;
}

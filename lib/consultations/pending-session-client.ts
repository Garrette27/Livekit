'use client';

const PENDING_CONSULTATION_SESSION_IDS_KEY = 'pending_consultation_session_ids';
const MAX_PENDING_IDS = 100;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function sanitize(ids: string[]): string[] {
  const deduped = Array.from(
    new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))
  );
  return deduped.slice(-MAX_PENDING_IDS);
}

export function getPendingConsultationSessionIds(): string[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(PENDING_CONSULTATION_SESSION_IDS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sanitize(parsed);
  } catch {
    return [];
  }
}

function writePendingConsultationSessionIds(ids: string[]): void {
  if (!isBrowser()) {
    return;
  }

  const normalized = sanitize(ids);
  if (normalized.length === 0) {
    window.localStorage.removeItem(PENDING_CONSULTATION_SESSION_IDS_KEY);
    return;
  }

  window.localStorage.setItem(
    PENDING_CONSULTATION_SESSION_IDS_KEY,
    JSON.stringify(normalized)
  );
}

export function addPendingConsultationSessionId(consultationSessionId?: string | null): void {
  if (!consultationSessionId) {
    return;
  }

  const existing = getPendingConsultationSessionIds();
  writePendingConsultationSessionIds([...existing, consultationSessionId]);
}

export function removePendingConsultationSessionIds(consultationSessionIds: string[]): void {
  if (!consultationSessionIds.length) {
    return;
  }

  const toRemove = new Set(consultationSessionIds);
  const remaining = getPendingConsultationSessionIds().filter((id) => !toRemove.has(id));
  writePendingConsultationSessionIds(remaining);
}


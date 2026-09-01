import {
  DRAFT_MAX_AGE_MS,
  DRAFT_STORAGE_PREFIX,
  isValidPeriod,
  LAST_CLASS_STORAGE_KEY,
} from './constants';
import { isValidISODate } from './format';
import type { AttendanceDraft, MarkingMode, StatusMap } from '@/types';

/**
 * Unsaved attendance lives in localStorage as well as React state, so an
 * accidental Safari refresh (or iOS discarding the tab) never loses a class
 * that has been marked but not yet saved.
 */

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function draftKey(date: string, subjectId: string | null, period: number | null): string {
  return `${DRAFT_STORAGE_PREFIX}${date}:${subjectId ?? 'no-subject'}:${period ?? 'no-period'}`;
}

function isStatusMap(value: unknown): value is StatusMap {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).every(
    (status) => status === 'PRESENT' || status === 'ABSENT',
  );
}

function isMode(value: unknown): value is MarkingMode {
  return value === 'MARK_ABSENT' || value === 'MARK_PRESENT';
}

export function loadDraft(key: string): AttendanceDraft | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AttendanceDraft>;
    if (
      typeof parsed?.date !== 'string' ||
      !isValidISODate(parsed.date) ||
      !isMode(parsed.mode) ||
      !isStatusMap(parsed.statuses) ||
      typeof parsed.savedAt !== 'number'
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    if (Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    return {
      date: parsed.date,
      subjectId: parsed.subjectId ?? null,
      period: isValidPeriod(parsed.period) ? parsed.period : null,
      mode: parsed.mode,
      statuses: parsed.statuses,
      sessionId: parsed.sessionId ?? null,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<AttendanceDraft, 'savedAt'>): void {
  if (!canUseStorage()) return;

  const key = draftKey(draft.date, draft.subjectId, draft.period);
  const payload: AttendanceDraft = { ...draft, savedAt: Date.now() };

  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Quota exceeded or private mode - the in-memory state still works.
  }
}

export function clearDraft(date: string, subjectId: string | null, period: number | null): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(draftKey(date, subjectId, period));
  } catch {
    // Ignore.
  }
}

/** Removes drafts older than DRAFT_MAX_AGE_MS. Cheap enough to run on mount. */
export function pruneDrafts(): void {
  if (!canUseStorage()) return;

  try {
    const stale: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith(DRAFT_STORAGE_PREFIX)) continue;

      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw) as Partial<AttendanceDraft>;
        if (typeof parsed?.savedAt !== 'number' || Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
          stale.push(key);
        }
      } catch {
        stale.push(key);
      }
    }

    stale.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore.
  }
}

export interface LastClass {
  subjectId: string | null;
  period: number | null;
  mode: MarkingMode;
}

/** Remembers the last subject/hour/mode so the next class is one tap away. */
export function loadLastClass(): LastClass | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(LAST_CLASS_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LastClass>;
    return {
      subjectId: typeof parsed.subjectId === 'string' ? parsed.subjectId : null,
      period: isValidPeriod(parsed.period) ? parsed.period : null,
      mode: isMode(parsed.mode) ? parsed.mode : 'MARK_ABSENT',
    };
  } catch {
    return null;
  }
}

export function saveLastClass(value: LastClass): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(LAST_CLASS_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore.
  }
}

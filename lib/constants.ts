export const APP_NAME = 'Attendance';
export const APP_LONG_NAME = 'Class Attendance';

/**
 * Class hours / periods.
 *
 * Configurable in one place: set NEXT_PUBLIC_PERIOD_COUNT to change how many
 * hours the app offers. The database allows 1-12 (see the period_range check
 * constraint in supabase/setup.sql), so the value is clamped to that range.
 */
const DEFAULT_PERIOD_COUNT = 6;
const MIN_PERIOD = 1;
const MAX_PERIOD = 12;

function resolvePeriodCount(): number {
  const raw = Number(process.env.NEXT_PUBLIC_PERIOD_COUNT);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_PERIOD_COUNT;
  return Math.min(MAX_PERIOD, Math.max(MIN_PERIOD, Math.floor(raw)));
}

export const PERIOD_COUNT = resolvePeriodCount();

export const PERIODS: number[] = Array.from({ length: PERIOD_COUNT }, (_, index) => index + 1);

export function isValidPeriod(period: number | null | undefined): period is number {
  return typeof period === 'number' && Number.isInteger(period) && PERIODS.includes(period);
}

/** localStorage keys. */
export const DRAFT_STORAGE_PREFIX = 'attendance:draft:v1:';
export const LAST_CLASS_STORAGE_KEY = 'attendance:last-class:v1';
export const ROSTER_CACHE_KEY = 'attendance:roster:v2';

/** Drafts older than this are pruned on load. */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

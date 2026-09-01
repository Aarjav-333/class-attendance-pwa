export type ClassValue = string | false | null | undefined;

/** Tiny classnames helper - no dependency needed for this app. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}

/**
 * Short vibration used as tap feedback when marking a student.
 * iOS Safari does not implement the Vibration API, so this is a no-op there -
 * the visual state change is the primary feedback and never depends on it.
 */
export function tapFeedback(pattern: number | number[] = 8): void {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as unknown as { vibrate?: (pattern: number | number[]) => boolean };
  if (typeof nav.vibrate !== 'function') return;
  try {
    nav.vibrate(pattern);
  } catch {
    // Ignore - feedback is decorative.
  }
}

/** Normalises text for accent- and case-insensitive search. */
export function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

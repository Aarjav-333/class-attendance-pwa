/**
 * Date helpers.
 *
 * Everything works on plain `YYYY-MM-DD` strings in the LOCAL timezone.
 * `new Date('2026-09-01')` parses as UTC midnight and can slip to the previous
 * day west of Greenwich, so ISO strings are always split manually.
 */

export function todayISO(): string {
  return toISODate(new Date());
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return new Date(NaN);
  return new Date(year, month - 1, day);
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return !Number.isNaN(parseISODate(iso).getTime());
}

/** 2026-09-01 -> "01 September 2026" */
export function formatDateLong(iso: string): string {
  const date = parseISODate(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** 2026-09-01 -> "01 Sep 2026" */
export function formatDateShort(iso: string): string {
  const date = parseISODate(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** 2026-09-01 -> "Tuesday" */
export function formatWeekday(iso: string): string {
  const date = parseISODate(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { weekday: 'long' });
}

/** "Today", "Yesterday" or the short date. */
export function formatRelativeDay(iso: string): string {
  const today = todayISO();
  if (iso === today) return 'Today';

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === toISODate(yesterday)) return 'Yesterday';

  return formatDateShort(iso);
}

/** ISO timestamp -> "01 Sep 2026, 14:32" */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 1 -> "01" (roll numbers always read as two digits). */
export function formatRoll(rollNumber: number): string {
  return `${rollNumber}`.padStart(2, '0');
}

export function shiftISODate(iso: string, days: number): string {
  const date = parseISODate(iso);
  if (Number.isNaN(date.getTime())) return iso;
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

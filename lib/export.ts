import { formatDateLong, formatRoll } from './format';
import type { AttendanceCounts, AttendanceStatus, SessionStudentStatus } from '@/types';

/**
 * CSV + human-readable export, with the Web Share API as the primary path on
 * iPhone and a file download as the fallback everywhere else.
 */

export interface ExportPayload {
  date: string;
  subjectCode: string;
  period: number;
  entries: SessionStudentStatus[];
  counts: AttendanceCounts;
}

export type ExportOutcome = 'shared' | 'downloaded' | 'copied' | 'cancelled';

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(payload: ExportPayload): string {
  const header = ['Date', 'Subject', 'Hour', 'Roll Number', 'Student Name', 'Status'];

  const rows = payload.entries.map((entry) =>
    [
      payload.date,
      payload.subjectCode,
      payload.period,
      entry.student.rollNumber,
      entry.student.name,
      entry.status,
    ]
      .map(escapeCsv)
      .join(','),
  );

  // A trailing newline keeps Excel and Numbers happy.
  return [header.join(','), ...rows].join('\r\n') + '\r\n';
}

function listByStatus(entries: SessionStudentStatus[], status: AttendanceStatus): string[] {
  return entries
    .filter((entry) => entry.status === status)
    .map((entry) => `${entry.student.rollNumber}. ${entry.student.name}`);
}

export function buildSummaryText(payload: ExportPayload): string {
  const present = listByStatus(payload.entries, 'PRESENT');
  const absent = listByStatus(payload.entries, 'ABSENT');

  const lines: string[] = [
    'ATTENDANCE',
    '',
    `Date: ${formatDateLong(payload.date)}`,
    `Subject: ${payload.subjectCode}`,
    `Hour: ${payload.period}`,
    '',
    `Total Students: ${payload.counts.total}`,
    `Present: ${payload.counts.present}`,
    `Absent: ${payload.counts.absent}`,
    '',
    'PRESENT',
    ...(present.length > 0 ? present : ['(none)']),
    '',
    'ABSENT',
    ...(absent.length > 0 ? absent : ['(none)']),
  ];

  return lines.join('\n');
}

export function exportFileName(payload: ExportPayload, extension: string): string {
  const subject = payload.subjectCode.replace(/[^a-z0-9]/gi, '') || 'subject';
  return `attendance-${payload.date}-${subject}-hour${payload.period}.${extension}`;
}

/** Short label such as "DL - Hour 3 - 01 September 2026". */
export function exportTitle(payload: ExportPayload): string {
  return `${payload.subjectCode} - Hour ${payload.period} - ${formatDateLong(payload.date)}`;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Give Safari a moment before revoking, otherwise the download can be dropped.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'NotAllowedError');
}

async function canShareFile(file: File): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Shares the CSV on iOS, downloads it elsewhere. */
export async function exportCsv(payload: ExportPayload): Promise<ExportOutcome> {
  const csv = buildCsv(payload);
  const fileName = exportFileName(payload, 'csv');
  const file = new File([csv], fileName, { type: 'text/csv' });

  if (await canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: exportTitle(payload) });
      return 'shared';
    } catch (error) {
      if (isAbortError(error)) return 'cancelled';
      // Fall through to a download if sharing failed for any other reason.
    }
  }

  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), fileName);
  return 'downloaded';
}

/** Shares the readable summary, or copies it to the clipboard as a fallback. */
export async function exportSummary(payload: ExportPayload): Promise<ExportOutcome> {
  const text = buildSummaryText(payload);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: exportTitle(payload), text });
      return 'shared';
    } catch (error) {
      if (isAbortError(error)) return 'cancelled';
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      // Fall through to a download.
    }
  }

  downloadBlob(
    new Blob([text], { type: 'text/plain;charset=utf-8;' }),
    exportFileName(payload, 'txt'),
  );
  return 'downloaded';
}

export function describeOutcome(outcome: ExportOutcome, what: string): string | null {
  switch (outcome) {
    case 'shared':
      return `${what} shared.`;
    case 'downloaded':
      return `${what} downloaded.`;
    case 'copied':
      return `${what} copied to the clipboard.`;
    case 'cancelled':
      return null;
  }
}

/** Roll numbers padded for display, e.g. "01, 07, 23". */
export function formatRollList(entries: SessionStudentStatus[], status: AttendanceStatus): string {
  return entries
    .filter((entry) => entry.status === status)
    .map((entry) => formatRoll(entry.student.rollNumber))
    .join(', ');
}

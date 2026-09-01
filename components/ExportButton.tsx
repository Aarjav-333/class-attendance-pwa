'use client';

import { useState } from 'react';

import { Sheet } from './Sheet';
import { ShareIcon, SpinnerIcon } from './Icons';
import { useToast } from './Toast';
import {
  buildSummaryText,
  describeOutcome,
  exportCsv,
  exportSummary,
  type ExportPayload,
} from '@/lib/export';
import { cn } from '@/lib/utils';

interface ExportButtonProps {
  payload: ExportPayload;
  className?: string;
  label?: string;
  disabled?: boolean;
}

/**
 * Export / share.
 *
 * On iPhone both options go through the Web Share API so attendance can be sent
 * straight to WhatsApp, Mail or Files; elsewhere the CSV downloads and the
 * summary is copied to the clipboard.
 */
export function ExportButton({ payload, className, label = 'Export', disabled }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'csv' | 'summary' | null>(null);
  const { showToast } = useToast();

  async function run(kind: 'csv' | 'summary') {
    setBusy(kind);
    try {
      const outcome = kind === 'csv' ? await exportCsv(payload) : await exportSummary(payload);
      const message = describeOutcome(outcome, kind === 'csv' ? 'CSV' : 'Summary');
      if (message) showToast(message, 'success');
      if (outcome !== 'cancelled') setOpen(false);
    } catch {
      showToast('Export failed. Please try again.', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || payload.entries.length === 0}
        className={cn('btn-secondary', className)}
      >
        <ShareIcon width={18} height={18} />
        {label}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Export attendance"
        description={`${payload.subjectCode} - Hour ${payload.period} - ${payload.counts.present}/${payload.counts.total} present`}
        busy={busy !== null}
        footer={
          <button type="button" className="btn-secondary w-full" onClick={() => setOpen(false)}>
            Close
          </button>
        }
      >
        <div className="space-y-2 pb-2">
          <ExportOption
            title="CSV file"
            description="Date, Subject, Hour, Roll Number, Student Name, Status"
            busy={busy === 'csv'}
            onClick={() => void run('csv')}
            disabled={busy !== null}
          />
          <ExportOption
            title="Readable summary"
            description="Formatted present / absent name lists"
            busy={busy === 'summary'}
            onClick={() => void run('summary')}
            disabled={busy !== null}
          />

          <details className="rounded-xl border border-line bg-bg px-3 py-2.5">
            <summary className="cursor-pointer list-none text-[14px] font-semibold text-muted">
              Preview summary
            </summary>
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-muted">
              {buildSummaryText(payload)}
            </pre>
          </details>
        </div>
      </Sheet>
    </>
  );
}

function ExportOption({
  title,
  description,
  onClick,
  busy,
  disabled,
}: {
  title: string;
  description: string;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-autofocus
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors focus-ring tap disabled:opacity-60"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
        {busy ? <SpinnerIcon width={18} height={18} /> : <ShareIcon width={18} height={18} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block truncate text-[13px] text-muted">{description}</span>
      </span>
    </button>
  );
}

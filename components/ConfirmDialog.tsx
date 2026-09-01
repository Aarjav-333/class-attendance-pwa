'use client';

import type { ReactNode } from 'react';

import { Sheet } from './Sheet';
import { SpinnerIcon } from './Icons';
import { cn } from '@/lib/utils';

export interface ConfirmAction {
  label: string;
  onClick: () => void;
  tone?: 'primary' | 'danger' | 'secondary';
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  /** Extra choices shown above the confirm button, e.g. "Keep current marks". */
  extraActions?: ConfirmAction[];
  onConfirm: () => void;
  onCancel: () => void;
}

/** Guards every destructive or irreversible action in the app. */
export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  extraActions,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      busy={busy}
      footer={
        <div className="flex flex-col gap-2">
          {extraActions?.map((action) => (
            <button
              key={action.label}
              type="button"
              className={cn(
                action.tone === 'danger'
                  ? 'btn-danger'
                  : action.tone === 'primary'
                    ? 'btn-primary'
                    : 'btn-secondary',
                'w-full',
              )}
              onClick={action.onClick}
              disabled={busy}
            >
              {action.label}
            </button>
          ))}

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={onCancel}
              disabled={busy}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              data-autofocus
              className={cn(tone === 'danger' ? 'btn-danger' : 'btn-primary', 'flex-1')}
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? <SpinnerIcon width={18} height={18} /> : null}
              {confirmLabel}
            </button>
          </div>
        </div>
      }
    >
      {children}
    </Sheet>
  );
}

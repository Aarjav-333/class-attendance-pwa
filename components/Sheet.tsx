'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Rendered in the sticky footer, usually the action buttons. */
  footer?: ReactNode;
  /** Blocks backdrop / Escape dismissal while an action is running. */
  busy?: boolean;
}

/**
 * Bottom sheet on phones, centred dialog on wider screens.
 * Every confirmation in the app uses this so the interaction is consistent.
 */
export function Sheet({ open, onClose, title, description, children, footer, busy }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };

    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the sheet for keyboard and screen-reader users.
    const timer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }, 30);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-[2px]"
        onClick={() => {
          if (!busy) onClose();
        }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 flex max-h-[88svh] w-full flex-col animate-sheet-up rounded-t-3xl border border-line bg-surface shadow-2xl',
          'sm:max-w-md sm:rounded-3xl',
        )}
      >
        <div className="shrink-0 px-5 pb-3 pt-4">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
          <h2 className="text-[19px] font-bold tracking-tight">{title}</h2>
          {description ? <div className="mt-1.5 text-[15px] text-muted">{description}</div> : null}
        </div>

        {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">{children}</div> : null}

        {footer ? (
          <div className="shrink-0 border-t border-line px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
            {footer}
          </div>
        ) : (
          <div className="pb-[max(env(safe-area-inset-bottom),0.5rem)]" />
        )}
      </div>
    </div>
  );
}

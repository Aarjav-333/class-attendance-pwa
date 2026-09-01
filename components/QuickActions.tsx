'use client';

import { CheckIcon, CrossIcon, RefreshIcon } from './Icons';

interface QuickActionsProps {
  onMarkAllPresent: () => void;
  onMarkAllAbsent: () => void;
  onReset: () => void;
  disabled?: boolean;
}

/** Bulk helpers. Reset is guarded by a confirmation in the parent screen. */
export function QuickActions({
  onMarkAllPresent,
  onMarkAllAbsent,
  onReset,
  disabled,
}: QuickActionsProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        onClick={onMarkAllPresent}
        disabled={disabled}
        className="btn-secondary px-2 text-[13px] font-semibold"
      >
        <CheckIcon width={16} height={16} className="text-present" />
        All Present
      </button>
      <button
        type="button"
        onClick={onMarkAllAbsent}
        disabled={disabled}
        className="btn-secondary px-2 text-[13px] font-semibold"
      >
        <CrossIcon width={16} height={16} className="text-absent" />
        All Absent
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={disabled}
        className="btn-secondary px-2 text-[13px] font-semibold"
      >
        <RefreshIcon width={16} height={16} className="text-muted" />
        Reset
      </button>
    </div>
  );
}

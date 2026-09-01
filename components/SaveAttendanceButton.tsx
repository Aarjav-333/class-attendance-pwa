'use client';

import { SaveIcon, SpinnerIcon } from './Icons';
import { cn } from '@/lib/utils';
import type { AttendanceCounts } from '@/types';

interface SaveAttendanceButtonProps {
  counts: AttendanceCounts;
  onSave: () => void;
  saving: boolean;
  /** true when an existing session is being edited. */
  editing: boolean;
  disabled?: boolean;
  disabledReason?: string | null;
}

/**
 * Sticky action bar. Sits above the iPhone home indicator via the
 * safe-area-inset-bottom padding.
 *
 * The live counts live in the sticky header instead of here, so this bar stays
 * slim and the student list keeps as much of the screen as possible.
 */
export function SaveAttendanceButton({
  counts,
  onSave,
  saving,
  editing,
  disabled,
  disabledReason,
}: SaveAttendanceButtonProps) {
  return (
    <div className="sticky bottom-0 z-30 border-t border-line bg-bg/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2.5 backdrop-blur">
      <button
        type="button"
        onClick={onSave}
        disabled={disabled || saving}
        aria-label={`${editing ? 'Update' : 'Save'} attendance: ${counts.present} present, ${counts.absent} absent, ${counts.total} total`}
        className={cn('btn-primary w-full text-[17px]', 'min-h-[54px]')}
      >
        {saving ? <SpinnerIcon width={20} height={20} /> : <SaveIcon width={20} height={20} />}
        {saving ? 'Saving...' : editing ? 'UPDATE ATTENDANCE' : 'SAVE ATTENDANCE'}
      </button>

      {disabled && disabledReason ? (
        <p className="mt-1.5 text-center text-[13px] font-medium text-absent">{disabledReason}</p>
      ) : null}
    </div>
  );
}

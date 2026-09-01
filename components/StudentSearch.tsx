'use client';

import { CrossIcon, SearchIcon } from './Icons';

interface StudentSearchProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
}

/**
 * Filters the list only - searching never changes anybody's attendance.
 */
export function StudentSearch({ value, onChange, resultCount, totalCount }: StudentSearchProps) {
  const filtering = value.trim().length > 0;

  return (
    <div>
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          width={18}
          height={18}
        />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={value}
          placeholder="Search name or roll number"
          aria-label="Search students by name or roll number"
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-full rounded-xl border border-line bg-surface pl-10 pr-11 text-[16px] text-fg placeholder:text-faint focus-ring"
        />
        {filtering ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange('')}
            className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-faint focus-ring"
          >
            <CrossIcon width={18} height={18} />
          </button>
        ) : null}
      </div>

      {filtering ? (
        <p className="mt-1.5 px-1 text-[13px] text-faint">
          Showing {resultCount} of {totalCount} students. Attendance marks are unchanged.
        </p>
      ) : null}
    </div>
  );
}

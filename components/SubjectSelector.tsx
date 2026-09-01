'use client';

import { cn } from '@/lib/utils';
import type { Subject } from '@/types';

interface SubjectSelectorProps {
  subjects: Subject[];
  value: string | null;
  onChange: (subjectId: string) => void;
  disabled?: boolean;
}

/** One-tap subject picker - deliberately not a dropdown. */
export function SubjectSelector({ subjects, value, onChange, disabled }: SubjectSelectorProps) {
  if (subjects.length === 0) {
    return <p className="text-[15px] text-muted">No subjects found. Run the setup SQL in Supabase.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Subject">
      {subjects.map((subject) => {
        const selected = subject.id === value;
        return (
          <button
            key={subject.id}
            type="button"
            aria-pressed={selected}
            title={subject.name}
            disabled={disabled}
            onClick={() => onChange(subject.id)}
            className={cn(
              'min-h-[48px] flex-1 basis-[68px] rounded-xl border px-2 text-[16px] font-bold tracking-wide transition-colors focus-ring tap',
              selected
                ? 'border-brand bg-brand text-brand-fg'
                : 'border-line bg-surface text-fg hover:border-brand/40',
              disabled && 'opacity-50',
            )}
          >
            {subject.code}
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { describeError, fetchStudents, fetchSubjects } from '@/lib/attendance';
import { ROSTER_CACHE_KEY } from '@/lib/constants';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import type { Student, Subject } from '@/types';

interface RosterCache {
  students: Student[];
  subjects: Subject[];
  savedAt: number;
}

interface RosterState {
  students: Student[];
  subjects: Subject[];
  loading: boolean;
  error: string | null;
  /** True while showing cached data because the network request failed. */
  stale: boolean;
}

function readCache(): RosterCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ROSTER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RosterCache>;
    if (!Array.isArray(parsed.students) || !Array.isArray(parsed.subjects)) return null;
    if (parsed.students.length === 0) return null;
    return {
      students: parsed.students,
      subjects: parsed.subjects,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

function writeCache(students: Student[], subjects: Subject[]): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: RosterCache = { students, subjects, savedAt: Date.now() };
    window.localStorage.setItem(ROSTER_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

/**
 * Loads the student and subject lists.
 *
 * The roster changes rarely, so a cached copy is painted immediately and then
 * revalidated. In a classroom with poor signal that means the marking screen is
 * usable straight away instead of waiting on the network.
 */
export function useRoster(): RosterState & { reload: () => void } {
  const [state, setState] = useState<RosterState>({
    students: [],
    subjects: [],
    loading: true,
    error: null,
    stale: false,
  });

  const mountedRef = useRef(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState({
        students: [],
        subjects: [],
        loading: false,
        error: 'Supabase is not configured yet.',
        stale: false,
      });
      return;
    }

    const cached = readCache();
    if (cached) {
      setState({
        students: cached.students,
        subjects: cached.subjects,
        loading: true,
        error: null,
        stale: false,
      });
    }

    let cancelled = false;

    (async () => {
      try {
        const [students, subjects] = await Promise.all([fetchStudents(), fetchSubjects()]);
        if (cancelled || !mountedRef.current) return;

        writeCache(students, subjects);
        setState({ students, subjects, loading: false, error: null, stale: false });
      } catch (error) {
        if (cancelled || !mountedRef.current) return;

        const message = describeError(error);
        setState((previous) =>
          previous.students.length > 0
            ? { ...previous, loading: false, error: null, stale: true }
            : { students: [], subjects: [], loading: false, error: message, stale: false },
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { ...state, reload };
}

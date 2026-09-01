'use client';

import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/types/database';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * False when `.env.local` has not been filled in yet. Screens check this and
 * render setup instructions instead of crashing with an opaque client error.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Derived from the factory so it always matches the installed client version. */
export type AppSupabaseClient = ReturnType<typeof createBrowserClient<Database>>;

let cachedClient: AppSupabaseClient | null = null;

/**
 * One shared browser client per tab. `createBrowserClient` stores the session
 * in cookies, which is what lets the middleware protect routes on the server.
 */
export function getSupabaseClient(): AppSupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.',
    );
  }

  const client = cachedClient ?? createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  cachedClient = client;
  return client;
}

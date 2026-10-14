'use client'
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readSupabaseEnv } from '@/lib/supabase/env'

/**
 * The browser's client, for the live meeting alone (milestone 14): Realtime, and the reads that follow a
 * signal. The anon key and the signed-in session, as the server client has them; every read is a definer
 * function or a table under row-level security. No other key exists in the browser (CLAUDE.md invariant 8).
 * Null when Supabase is not configured, so the page runs without sync instead of failing.
 */
let client: SupabaseClient | null | undefined

export function browserClient(): SupabaseClient | null {
  if (client !== undefined) return client
  const env = readSupabaseEnv()
  client = 'problem' in env ? null : createBrowserClient(env.url, env.key)
  return client
}

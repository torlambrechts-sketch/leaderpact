'use client'
import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { capSessionCookie } from '@/lib/supabase/cookies'
import { readSupabaseEnv } from '@/lib/supabase/env'

/**
 * The browser's client, for the live meeting alone (milestone 14): Realtime, and the reads that follow a
 * signal. The anon key and the signed-in session, as the server client has them; every read is a definer
 * function or a table under row-level security. No other key exists in the browser (CLAUDE.md invariant 8).
 * Null when Supabase is not configured, so the page runs without sync instead of failing.
 *
 * Its cookies are written here rather than by the library's own document.cookie writer, which sets 400 days:
 * a token refreshed during a meeting keeps the 30 days the server client and the middleware keep (D-61).
 */
let client: SupabaseClient | null | undefined

export function browserClient(): SupabaseClient | null {
  if (client !== undefined) return client
  const env = readSupabaseEnv()
  client =
    'problem' in env
      ? null
      : createBrowserClient(env.url, env.key, {
          cookies: {
            getAll: () => parseCookieHeader(document.cookie),
            setAll: (toSet) => {
              for (const { name, value, options } of toSet) document.cookie = serializeCookieHeader(name, value, capSessionCookie(options))
            },
          },
        })
  return client
}

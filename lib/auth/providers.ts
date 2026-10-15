import 'server-only'
import { z } from 'zod'
import { readSupabaseEnv } from '@/lib/supabase/env'
import { PROVIDERS, type Provider } from '@/lib/auth/schema'

/**
 * The providers to offer: those this product names (lib/auth/schema.ts) that the Auth project has turned on.
 * Auth publishes which are on at `/auth/v1/settings`, read with the public key, so a button appears the day the
 * owner turns a provider on and never before (CLAUDE.md: nothing in the UI that is not real). Kept for five
 * minutes; a failed read offers none, and the email ways in still work.
 */
const settingsSchema = z.object({ external: z.record(z.string(), z.boolean()) })

export async function enabledProviders(): Promise<Provider[]> {
  const env = readSupabaseEnv()
  if ('problem' in env) return []
  try {
    const res = await fetch(`${env.url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: env.key },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return []
    const parsed = settingsSchema.safeParse(await res.json())
    if (!parsed.success) return []
    return PROVIDERS.filter((p) => parsed.data.external[p] === true)
  } catch {
    return []
  }
}

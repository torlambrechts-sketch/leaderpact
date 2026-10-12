'use server'
import { anonClient } from '@/lib/supabase/anon'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { submitReplySchema, submitSchema, type SubmitResult } from '@/lib/scan/link'

/**
 * The scan's one write path from the app (handoff 6.5; CLAUDE.md invariant 4): `app.submit_scan`, which
 * checks every answer, applies the cap and the replacement, and never returns an id (0006).
 *
 * - **Always as a visitor.** The anon client carries no session, so the request that writes answers
 *   names nobody, the leader's own included (owner C4: the leader answers like everyone else). What
 *   remains is the residual owner C3 names: the request's time.
 * - **Nothing of the answers is logged**, nor the code: a failure is logged by its PostgREST code alone
 *   (CLAUDE.md invariant 10).
 * - Rate limits on the public link (handoff 8: 60 per address per hour) come with milestone 16.
 */
export async function submitScan(input: unknown): Promise<SubmitResult> {
  const parsed = submitSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const client = anonClient()
  if (!client) {
    console.error('[scan] submitScan: no Supabase configuration')
    return { ok: false, reason: 'failed' }
  }
  const { data, error } = await client.schema('app').rpc('submit_scan', {
    p_code: parsed.data.code,
    p_answers: parsed.data.answers,
    p_replace_key: parsed.data.replaceKey,
  })
  if (callFailed('submitScan', error)) return { ok: false, reason: 'failed' }
  const reply = submitReplySchema.safeParse(data)
  if (parseFailed('submitScan', reply)) return { ok: false, reason: 'failed' }
  return reply.data.ok ? { ok: true, replaceKey: reply.data.replace_key } : { ok: false, reason: reply.data.reason }
}

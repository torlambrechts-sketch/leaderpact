import 'server-only'
import { anonClient } from '@/lib/supabase/anon'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { submitReplySchema, type SubmitInput, type SubmitResult } from '@/lib/scan/link'

/**
 * The scan's one write path from the app (handoff 6.5; CLAUDE.md invariant 4): `app.submit_scan`, which
 * checks every answer, applies the cap and the replacement, and never returns an id (0006). The route that
 * calls it (app/api/scan) counts the network first: 60 an hour (handoff 8, milestone 16).
 *
 * - **Always as a visitor.** The anon client carries no session, so the request that writes answers
 *   names nobody, the leader's own included (owner C4: the leader answers like everyone else). What
 *   remains is the residual owner C3 names: the request's time.
 * - **Nothing of the answers is logged**, nor the code: a failure is logged by its PostgREST code alone
 *   (CLAUDE.md invariant 10).
 */
export async function submitScanAnswers(input: SubmitInput): Promise<SubmitResult> {
  const client = anonClient()
  if (!client) {
    console.error('[scan] submitScan: no Supabase configuration')
    return { ok: false, reason: 'failed' }
  }
  const { data, error } = await client.schema('app').rpc('submit_scan', {
    p_code: input.code,
    p_answers: input.answers,
    p_replace_key: input.replaceKey,
  })
  if (callFailed('submitScan', error)) return { ok: false, reason: 'failed' }
  const reply = submitReplySchema.safeParse(data)
  if (parseFailed('submitScan', reply)) return { ok: false, reason: 'failed' }
  return reply.data.ok ? { ok: true, replaceKey: reply.data.replace_key } : { ok: false, reason: reply.data.reason }
}

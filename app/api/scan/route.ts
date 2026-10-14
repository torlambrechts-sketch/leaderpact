import { NextResponse } from 'next/server'
import { clientAddress, keyed, networkOf, takePublicRate } from '@/lib/limits/key'
import { submitSchema, type SubmitResult } from '@/lib/scan/link'
import { submitScanAnswers } from '@/lib/scan/submit'

/**
 * The scan's answers, from the invite link and the leader's save (handoff 6.5). A network sends at most 60 an
 * hour (handoff 8): past that, HTTP 429 with the seconds to wait, in Retry-After and in the body. The body is
 * the submission's own answer, never an id (CLAUDE.md invariant 4); nothing of the answers is logged.
 */
export async function POST(request: Request): Promise<NextResponse<SubmitResult>> {
  const body = await request.json().catch(() => null)
  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 })

  const network = networkOf(clientAddress(request.headers))
  const wait = network ? await takePublicRate('scan_submit', keyed(`network:${network}`)) : 0
  if (wait > 0) {
    return NextResponse.json({ ok: false, reason: 'rate_limited', retry: wait }, { status: 429, headers: { 'Retry-After': String(wait) } })
  }
  return NextResponse.json(await submitScanAnswers(parsed.data), { headers: { 'Cache-Control': 'no-store' } })
}

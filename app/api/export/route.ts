import { NextResponse } from 'next/server'
import { exportReplySchema, type ExportResult } from '@/lib/account/schema'
import { sameOrigin } from '@/lib/limits/same-origin'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * "Download my data" (handoff 6.18): the export is built now and its link mailed (0023 request_export; the
 * dispatcher sends it). At most 5 a person a day (handoff 8): past that, HTTP 429 with the seconds to wait, in
 * Retry-After and in the body. Only codes are logged.
 */
export async function POST(request: Request): Promise<NextResponse<ExportResult>> {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, reason: 'failed' }, { status: 403, headers: NO_STORE })
  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error('[account] requestExport: no Supabase configuration')
    return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500, headers: NO_STORE })
  }
  const { data, error } = await supabase.schema('app').rpc('request_export')
  if (callFailed('requestExport', error)) return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500, headers: NO_STORE })
  const reply = exportReplySchema.safeParse(data)
  if (parseFailed('requestExport', reply)) return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500, headers: NO_STORE })
  if (reply.data.ok) return NextResponse.json({ ok: true }, { headers: NO_STORE })
  if (reply.data.reason === 'signed_out') return NextResponse.json({ ok: false, reason: 'signed_out' }, { status: 401, headers: NO_STORE })
  const retry = reply.data.retry
  return NextResponse.json({ ok: false, reason: 'too_many', retry }, { status: 429, headers: { ...NO_STORE, 'Retry-After': String(retry) } })
}

import type { SubmitInput, SubmitResult } from '@/lib/scan/link'

/**
 * The browser's side of the scan's write path: one POST to app/api/scan, which counts the network and calls
 * `submit_scan` (lib/scan/submit.ts). A 429 comes back as `rate_limited` with the seconds to wait.
 */
export async function submitScan(input: SubmitInput): Promise<SubmitResult> {
  const res = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
  const body = (await res.json().catch(() => null)) as SubmitResult | null
  if (!body || typeof body !== 'object' || !('ok' in body)) return { ok: false, reason: 'failed' }
  return body
}

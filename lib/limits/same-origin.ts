import 'server-only'

/**
 * Whether a request that changes something came from this site's own pages: its Origin names the host it was
 * sent to. Server actions check this themselves; a route handler asks here, so another site cannot make a
 * signed-in browser spend its own limits.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '').split(',')[0]!.trim()
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NEW_GROUP_PATH, SIGN_IN_PATH } from '@/lib/routes'

/**
 * Where Google or Microsoft send the person back (D-57): the code, exchanged for a session with the verifier
 * this device kept when it left (PKCE), then on to their group or the form to make one, as after every sign-in.
 * A refusal at the provider, or a code that does not exchange, goes back to the sign-in page, which says so.
 * Locations are relative, so a proxy's host never ends up in them. Nothing about the person is logged.
 */
const back = (path: string) => new NextResponse(null, { status: 303, headers: { location: path } })

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('code')
  if (!code || params.get('error') || !/^[A-Za-z0-9_-]{8,512}$/.test(code)) return back(`${SIGN_IN_PATH}?problem=provider`)
  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error('[auth] callback: no Supabase configuration')
    return back(`${SIGN_IN_PATH}?problem=provider`)
  }
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error(`[auth] callback: ${error.code ?? 'unknown'} (${error.status ?? 'no status'})`)
    return back(`${SIGN_IN_PATH}?problem=provider`)
  }
  return back(NEW_GROUP_PATH)
}

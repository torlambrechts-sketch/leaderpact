import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authCodeSchema } from '@/lib/auth/schema'
import { signedInBy } from '@/lib/auth/amr'
import { NEW_GROUP_PATH, NEW_PASSWORD_PATH, SIGN_IN_PATH } from '@/lib/routes'

/**
 * Where Google or Microsoft send the person back (D-57), and where a mail link that passed through Auth ends up
 * (D-58): the code, exchanged for a session with the verifier this device kept when it left (PKCE), then on to
 * their group or the form to make one, as after every sign-in.
 *
 * A password-reset link goes on to the form for a new password instead (D-63): Auth marks the session it makes
 * from such a link as signed in by `recovery`, whichever template the mail used. Without this, the reset signed
 * the person in and sent them to make a group, with no new password.
 *
 * A refusal at the provider, or a code that does not exchange, goes back to the sign-in page, which says so. A mail
 * link (`via=mail`, set by the confirmation page) that does not exchange says what usually happened: it was opened
 * in another browser than the one that asked for it, or it was used or had lapsed.
 * Locations are relative, so a proxy's host never ends up in them. Nothing about the person is logged.
 */
const back = (path: string) => new NextResponse(null, { status: 303, headers: { location: path } })

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const failed = `${SIGN_IN_PATH}?problem=${params.get('via') === 'mail' ? 'link' : 'provider'}`
  const code = authCodeSchema.safeParse(params.get('code'))
  if (!code.success || params.get('error')) return back(failed)
  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error('[auth] callback: no Supabase configuration')
    return back(failed)
  }
  const { data, error } = await supabase.auth.exchangeCodeForSession(code.data)
  if (error) {
    console.error(`[auth] callback: ${error.code ?? 'unknown'} (${error.status ?? 'no status'})`)
    return back(failed)
  }
  return back(signedInBy(data?.session?.access_token).includes('recovery') ? NEW_PASSWORD_PATH : NEW_GROUP_PATH)
}

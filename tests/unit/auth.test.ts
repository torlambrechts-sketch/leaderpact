import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { confirmSchema, newPasswordSchema, passwordSignInSchema, providerSchema, signInWays, signUpSchema } from '@/lib/auth/schema'

/**
 * Signing up and in with a password, Google or Microsoft (owner, 15 October 2026; D-57). What the database does
 * with the name and company is supabase/tests/signup_invariants.sql; the whole flow against real Auth and its
 * mail is tests/e2e/sign-up.spec.ts (CI). Here: the boundary, how each Auth answer reads to the person, and that
 * nothing tells whether an address has an account.
 */

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}))
const rate = vi.hoisted(() => ({ take: vi.fn(async () => 0) }))
const origin = vi.hoisted(() => ({ value: 'https://app.example' as string | null }))

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth }) }))
vi.mock('@/lib/auth/origin', () => ({ requestOrigin: async () => origin.value }))
vi.mock('@/lib/limits/key', () => ({ keyed: (v: string) => `k(${v})`, takePublicRate: rate.take }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`)
  },
}))

const { requestPasswordReset, resendConfirmation, setNewPassword, signInWithPassword, signUpWithPassword, startProviderSignIn } = await import(
  '@/lib/auth/password'
)
const { GET: callback } = await import('@/app/(public)/auth/callback/route')

const err = (code: string, status = 400) => ({ code, status, message: 'from Auth' })
const person = { name: 'Sigrid Haugen', email: ' Sigrid@Haugen.example ', company: 'Haugen Holding AS', password: 'a long enough password' }

beforeEach(() => {
  for (const f of Object.values(auth)) f.mockReset()
  rate.take.mockReset().mockResolvedValue(0)
  origin.value = 'https://app.example'
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('the boundary', () => {
  it('a sign-up is a name, a work email, a company and a password of 10 to 72 characters, and nothing else', () => {
    const ok = signUpSchema.safeParse(person)
    expect(ok.success && ok.data.email).toBe('sigrid@haugen.example')
    expect(signUpSchema.safeParse({ ...person, password: 'nine char' }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...person, password: 'x'.repeat(73) }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...person, password: 'x'.repeat(72) }).success).toBe(true)
    expect(signUpSchema.safeParse({ ...person, name: '   ' }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...person, company: 'x'.repeat(201) }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...person, role: 'leader' }).success).toBe(false)
  })

  it('signing in takes any password up to 72 characters; a new one is held to the sign-up rule', () => {
    expect(passwordSignInSchema.safeParse({ email: 'a@b.example', password: 'short' }).success).toBe(true)
    expect(passwordSignInSchema.safeParse({ email: 'a@b.example', password: '' }).success).toBe(false)
    expect(newPasswordSchema.safeParse({ password: 'short' }).success).toBe(false)
    expect(newPasswordSchema.safeParse({ password: 'long enough now' }).success).toBe(true)
  })

  it('the mail link confirms a sign-in, a sign-up or a reset, and nothing else', () => {
    for (const type of ['email', 'signup', 'recovery']) expect(confirmSchema.safeParse({ token_hash: 'a'.repeat(40), type }).success).toBe(true)
    expect(confirmSchema.safeParse({ token_hash: 'a'.repeat(40), type: 'magiclink' }).success).toBe(false)
    expect(confirmSchema.safeParse({ token_hash: 'a'.repeat(40), type: 'invite' }).success).toBe(false)
  })

  it('the providers are Google and Microsoft, as Auth names them', () => {
    expect(providerSchema.options).toEqual(['google', 'azure'])
    expect(providerSchema.safeParse('github').success).toBe(false)
  })

  it('the Account tab shows the ways an account holds, and nothing it does not', () => {
    expect(signInWays({ provider: 'google', providers: ['google', 'email', 'github'] })).toEqual(['email', 'google'])
    expect(signInWays({ provider: 'azure', providers: ['azure'] })).toEqual(['azure'])
    expect(signInWays({ provider: 'email' })).toEqual(['email'])
    expect(signInWays({})).toEqual([])
    expect(signInWays(null)).toEqual([])
    expect(signInWays({ providers: 'email' })).toEqual([])
  })
})

describe('signing up with a password', () => {
  it('sends the name and company as metadata and the confirmation back to this site', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: 'u' }, session: null }, error: null })
    await expect(signUpWithPassword(person)).resolves.toEqual({ ok: true })
    expect(rate.take).toHaveBeenCalledWith('sign_in', 'k(address:sigrid@haugen.example)')
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'sigrid@haugen.example',
      password: 'a long enough password',
      options: { emailRedirectTo: 'https://app.example/auth/confirm', data: { full_name: 'Sigrid Haugen', company: 'Haugen Holding AS' } },
    })
  })

  it('an address that already has an account reads as a new one', async () => {
    for (const code of ['user_already_exists', 'email_exists']) {
      auth.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: err(code, 422) })
      await expect(signUpWithPassword(person)).resolves.toEqual({ ok: true })
    }
  })

  it('a weak password, a refused address, a limit and anything else each read as themselves', async () => {
    const cases: Array<[ReturnType<typeof err>, string]> = [
      [err('weak_password', 422), 'weak_password'],
      [err('email_address_invalid'), 'invalid'],
      [err('over_email_send_rate_limit', 429), 'rate_limited'],
      [err('unexpected_failure', 500), 'failed'],
    ]
    for (const [error, reason] of cases) {
      auth.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error })
      await expect(signUpWithPassword(person)).resolves.toEqual({ ok: false, reason })
    }
  })

  it('the address limit is counted before Auth is asked, and an invalid form never reaches it', async () => {
    rate.take.mockResolvedValueOnce(60)
    await expect(signUpWithPassword(person)).resolves.toEqual({ ok: false, reason: 'rate_limited' })
    await expect(signUpWithPassword({ ...person, password: 'short' })).resolves.toEqual({ ok: false, reason: 'invalid' })
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  it('a project that confirms no address goes straight on to the group', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: 'u' }, session: { access_token: 't' } }, error: null })
    await expect(signUpWithPassword(person)).rejects.toThrow('redirect:/app/new')
  })

  it('logs the error code, never the address, the name or the password', async () => {
    auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: err('unexpected_failure', 500) })
    await signUpWithPassword(person)
    const logged = vi.mocked(console.error).mock.calls.flat().join(' ')
    expect(logged).toContain('unexpected_failure')
    for (const value of ['sigrid', 'Sigrid', 'Haugen', 'long enough']) expect(logged).not.toContain(value)
  })
})

describe('signing in with a password', () => {
  it('goes on to the group; a wrong password and an unknown address read the same', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: null })
    await expect(signInWithPassword({ email: person.email, password: 'whatever' })).rejects.toThrow('redirect:/app/new')
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'sigrid@haugen.example', password: 'whatever' })
    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: err('invalid_credentials') })
    await expect(signInWithPassword({ email: person.email, password: 'whatever' })).resolves.toEqual({ ok: false, reason: 'wrong' })
  })

  it('an address not yet confirmed is told so; a limit reads as a limit', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: err('email_not_confirmed') })
    await expect(signInWithPassword({ email: person.email, password: 'x' })).resolves.toEqual({ ok: false, reason: 'unconfirmed' })
    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: err('over_request_rate_limit', 429) })
    await expect(signInWithPassword({ email: person.email, password: 'x' })).resolves.toEqual({ ok: false, reason: 'rate_limited' })
  })
})

describe('the mails again: a confirmation and a reset', () => {
  it('answer the same whether or not the address has an account', async () => {
    auth.resend.mockResolvedValueOnce({ data: {}, error: null })
    await expect(resendConfirmation({ email: person.email })).resolves.toEqual({ ok: true })
    expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'sigrid@haugen.example', options: { emailRedirectTo: 'https://app.example/auth/confirm' } })
    auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: err('user_not_found', 404) })
    await expect(requestPasswordReset({ email: person.email })).resolves.toEqual({ ok: true })
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('sigrid@haugen.example', { redirectTo: 'https://app.example/auth/confirm' })
  })

  it('are counted against the address, and a limit reads as a limit', async () => {
    rate.take.mockResolvedValueOnce(30)
    await expect(requestPasswordReset({ email: person.email })).resolves.toEqual({ ok: false, reason: 'rate_limited' })
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
    auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: err('over_email_send_rate_limit', 429) })
    await expect(requestPasswordReset({ email: person.email })).resolves.toEqual({ ok: false, reason: 'rate_limited' })
  })

  it('without an address this request was made to, nothing is sent', async () => {
    origin.value = null
    await expect(requestPasswordReset({ email: person.email })).resolves.toEqual({ ok: false, reason: 'failed' })
    await expect(signUpWithPassword(person)).resolves.toEqual({ ok: false, reason: 'failed' })
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
    expect(auth.signUp).not.toHaveBeenCalled()
  })
})

describe('a new password', () => {
  it('is set for the signed-in person, then on to the group', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } } })
    auth.updateUser.mockResolvedValueOnce({ data: {}, error: null })
    await expect(setNewPassword({ password: 'another long password' })).rejects.toThrow('redirect:/app/new')
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'another long password' })
  })

  it('signed out, too short, the same as before or weak, each reads as itself', async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: null } })
    await expect(setNewPassword({ password: 'another long password' })).resolves.toEqual({ ok: false, reason: 'signed_out' })
    await expect(setNewPassword({ password: 'short' })).resolves.toEqual({ ok: false, reason: 'invalid' })
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } } })
    auth.updateUser.mockResolvedValueOnce({ data: {}, error: err('same_password', 422) })
    await expect(setNewPassword({ password: 'another long password' })).resolves.toEqual({ ok: false, reason: 'same_password' })
    auth.updateUser.mockResolvedValueOnce({ data: {}, error: err('weak_password', 422) })
    await expect(setNewPassword({ password: 'another long password' })).resolves.toEqual({ ok: false, reason: 'weak_password' })
  })
})

describe('Google and Microsoft', () => {
  const form = (provider: string) => {
    const f = new FormData()
    f.set('provider', provider)
    return f
  }

  it("leaves for the provider's address, to come back to the callback", async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: { url: 'https://auth.example/authorize?x=1' }, error: null })
    await expect(startProviderSignIn(form('google'))).rejects.toThrow('redirect:https://auth.example/authorize?x=1')
    expect(auth.signInWithOAuth).toHaveBeenLastCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://app.example/auth/callback', skipBrowserRedirect: true },
    })
    await expect(startProviderSignIn(form('azure'))).rejects.toThrow('redirect:https://auth.example/authorize?x=1')
    expect(auth.signInWithOAuth).toHaveBeenLastCalledWith({
      provider: 'azure',
      options: { redirectTo: 'https://app.example/auth/callback', skipBrowserRedirect: true, scopes: 'email' },
    })
  })

  it('a provider this product does not offer, or one Auth refuses, goes back to sign-in and says so', async () => {
    await expect(startProviderSignIn(form('github'))).rejects.toThrow('redirect:/sign-in?problem=provider')
    expect(auth.signInWithOAuth).not.toHaveBeenCalled()
    auth.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: err('provider_disabled') })
    await expect(startProviderSignIn(form('google'))).rejects.toThrow('redirect:/sign-in?problem=provider')
  })

  describe('the callback', () => {
    const at = (query: string) => callback(new NextRequest(`https://app.example/auth/callback${query}`))

    it('exchanges the code and goes on, with a relative location', async () => {
      auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null })
      const res = await at('?code=abc123DEF-_xyz')
      expect(res.status).toBe(303)
      expect(res.headers.get('location')).toBe('/app/new')
      expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123DEF-_xyz')
    })

    it('a refusal, a missing or malformed code, or one that does not exchange, goes back to sign-in', async () => {
      for (const query of ['', '?error=access_denied&code=abc123DEF-_xyz', '?code=short', '?code=has%20space%20in%20it', `?code=${'a'.repeat(513)}`]) {
        const res = await at(query)
        expect(res.status).toBe(303)
        expect(res.headers.get('location')).toBe('/sign-in?problem=provider')
      }
      expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
      auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: err('bad_code_verifier') })
      expect((await at('?code=abc123DEF-_xyz')).headers.get('location')).toBe('/sign-in?problem=provider')
    })
  })
})

describe('which providers show', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321/')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-key')
  })

  const settings = async (reply: () => Promise<Response>) => {
    const fetch = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(() => reply())
    vi.stubGlobal('fetch', fetch)
    const { enabledProviders } = await import('@/lib/auth/providers')
    const out = await enabledProviders()
    vi.unstubAllGlobals()
    return { out, fetch }
  }

  it('those this product names that Auth reports on, in its order', async () => {
    const { out, fetch } = await settings(async () => Response.json({ external: { github: true, azure: true, google: true, email: true } }))
    expect(out).toEqual(['google', 'azure'])
    expect(fetch.mock.calls[0]![0]).toBe('http://127.0.0.1:54321/auth/v1/settings')
    expect((await settings(async () => Response.json({ external: { google: false, azure: true } }))).out).toEqual(['azure'])
  })

  it('none when the read fails, answers an error or reads wrong, or the project is not LeaderPact\'s', async () => {
    expect((await settings(async () => new Response('down', { status: 503 }))).out).toEqual([])
    expect((await settings(async () => Response.json({ external: 'everything' }))).out).toEqual([])
    expect((await settings(async () => Promise.reject(new Error('timeout')))).out).toEqual([])
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://jmhhszsnjfqgclxzhciq.supabase.co')
    const foreign = await settings(async () => Response.json({ external: { google: true } }))
    expect(foreign.out).toEqual([])
    expect(foreign.fetch).not.toHaveBeenCalled()
  })
})

describe('a mail link that passed through Auth (D-58)', () => {
  const params = (p: Record<string, string>) => ({ searchParams: Promise.resolve(p) })

  it('the site address sends a token to the confirmation page and a code to be exchanged; anything else to the landing page', async () => {
    const { default: Root } = await import('@/app/page')
    await expect(Root(params({ token_hash: 'a'.repeat(40), type: 'recovery' }))).rejects.toThrow(`redirect:/auth/confirm?token_hash=${'a'.repeat(40)}&type=recovery`)
    await expect(Root(params({ code: '0b7c2d6e-9f1a-4c3b-8d2e-5f6a7b8c9d0e' }))).rejects.toThrow('redirect:/auth/callback?code=0b7c2d6e-9f1a-4c3b-8d2e-5f6a7b8c9d0e')
    await expect(Root(params({ code: 'not a code' }))).rejects.toThrow('redirect:/leadership-team-assessment')
    await expect(Root(params({}))).rejects.toThrow('redirect:/leadership-team-assessment')
  })

  it('the confirmation page sends a code without a token to be exchanged', async () => {
    const { default: ConfirmPage } = await import('@/app/(public)/auth/confirm/page')
    await expect(ConfirmPage(params({ code: '0b7c2d6e-9f1a-4c3b-8d2e-5f6a7b8c9d0e' }))).rejects.toThrow('redirect:/auth/callback?code=0b7c2d6e-9f1a-4c3b-8d2e-5f6a7b8c9d0e')
  })
})

import { z } from 'zod'

/**
 * What crosses the sign-in boundary, parsed on the server (CLAUDE.md: Zod at every server boundary) and
 * shared with the forms that send it.
 */

/** An email address as a person types it: trimmed and lower-cased before it is checked */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254))

/**
 * A sign-in link is asked for from three places. `save` comes from the personal view's save card and may
 * make an account (handoff 6.3: "if the email is already registered, sign in and add the group");
 * `profile` comes from a finished Leader Profile that a visitor keeps (handoff 6.17), and may make one too;
 * `sign_in` comes from the sign-in page and never makes one. So an account exists only for someone who
 * kept a scan or a profile.
 */
export const linkRequestSchema = z.object({
  email: emailSchema,
  intent: z.enum(['save', 'profile', 'sign_in', 'sign_up']),
})
export type LinkRequest = z.infer<typeof linkRequestSchema>

export type LinkResult = { ok: true } | { ok: false; reason: 'invalid' | 'rate_limited' | 'failed' }

/**
 * The email link's two parameters (supabase/templates). Auth makes the token single-use and short-lived;
 * here it is only checked for shape, so nothing malformed is sent on. `email` is a sign-in link or a first
 * one that makes the account, `signup` confirms an address given with a password, `recovery` sets a new
 * password (D-57).
 */
export const CONFIRM_TYPES = ['email', 'signup', 'recovery'] as const
export const confirmSchema = z.object({
  token_hash: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  type: z.enum(CONFIRM_TYPES),
})

export type ConfirmState = { problem: 'expired' | 'failed' } | null

/**
 * Signing up and in with a password (owner, 15 October 2026; D-57). A password is 10 to 72 characters: Auth
 * holds it as a bcrypt hash, which reads 72 bytes, and the project asks for at least 10 (supabase/config.toml).
 * Length is the rule, not character classes (NIST SP 800-63B).
 */
export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 72
export const passwordSchema = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX)
export const personNameSchema = z.string().trim().min(1).max(120)
export const companySchema = z.string().trim().min(1).max(200)

export const signUpSchema = z.strictObject({ name: personNameSchema, email: emailSchema, company: companySchema, password: passwordSchema })
export const passwordSignInSchema = z.strictObject({ email: emailSchema, password: z.string().min(1).max(PASSWORD_MAX) })
export const resetRequestSchema = z.strictObject({ email: emailSchema })
export const newPasswordSchema = z.strictObject({ password: passwordSchema })

export type SignUpResult = { ok: true } | { ok: false; reason: 'invalid' | 'weak_password' | 'rate_limited' | 'failed' }
export type PasswordSignInResult = { ok: false; reason: 'invalid' | 'wrong' | 'unconfirmed' | 'rate_limited' | 'failed' }
export type NewPasswordResult = { ok: false; reason: 'invalid' | 'weak_password' | 'same_password' | 'signed_out' | 'failed' }

/** The sign-in providers this product offers besides email, as Supabase Auth names them (D-57) */
export const PROVIDERS = ['google', 'azure'] as const
export type Provider = (typeof PROVIDERS)[number]
export const providerSchema = z.enum(PROVIDERS)

/**
 * How an account signs in, from Auth's `app_metadata` (Account tab, D-57): `providers` lists every identity the
 * account holds; a session minted for local work carries `provider` alone. Anything else is left out.
 */
export const SIGN_IN_WAYS = ['email', ...PROVIDERS] as const
export type SignInWay = (typeof SIGN_IN_WAYS)[number]
const appMetadataSchema = z.object({ provider: z.string().optional(), providers: z.array(z.string()).optional() })

export function signInWays(appMetadata: unknown): SignInWay[] {
  const parsed = appMetadataSchema.safeParse(appMetadata)
  if (!parsed.success) return []
  const held = new Set(parsed.data.providers ?? (parsed.data.provider ? [parsed.data.provider] : []))
  return SIGN_IN_WAYS.filter((way) => held.has(way))
}

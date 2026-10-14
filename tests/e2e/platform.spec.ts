import { execFileSync } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { canDispatch } from './support/dispatch'

/**
 * Milestone 17 (handoff A.3; D-54): "a command round-trips. A replayed token is refused." Sentral's product-command
 * signs an HS256 token (its _shared/signing.ts signJwt) and posts `{p_token, p_command, p_args}` to the product's
 * /rest/v1/rpc/platform_command with the public key. This does the same against the local stack, with the token
 * secret read from the local Vault. supabase/tests/platform_invariants.sql proves every refusal.
 */
const DB = process.env.DB_URL ?? process.env.DATABASE_URL ?? ''
const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url')

/** Sentral's signJwt, in Node */
function signJwt(claims: Record<string, unknown>, secret: string): string {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(claims))
  return `${head}.${body}.${createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')}`
}

test('a command signed as Sentral signs it round-trips through the Data API, and its replay is refused', async ({ request }, info) => {
  test.skip(info.project.name !== 'desktop', 'once')
  test.skip(!canDispatch() || !process.env.NEXT_PUBLIC_SUPABASE_URL, 'needs the local database and its Data API')
  const secret = execFileSync('psql', [DB, '-At', '-c', "select decrypted_secret from vault.decrypted_secrets where name = 'leaderpact_platform_token_secret'"], { encoding: 'utf8' }).trim()
  expect(secret).toMatch(/^[0-9a-f]{64}$/)
  const api = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const now = Math.floor(Date.now() / 1000)
  const token = signJwt({ aud: 'leaderpact', sub: 'e2e@sentral.example', scope: 'orgs:read', jti: randomUUID(), iat: now, exp: now + 120 }, secret)
  const call = () =>
    request.post(`${api}/rest/v1/rpc/platform_command`, {
      headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      data: { p_token: token, p_command: 'orgs.list', p_args: { p_limit: 500 } },
    })

  const first = await call()
  expect(first.status()).toBe(200)
  const reply = (await first.json()) as { ok: boolean; result: Array<{ id: string; name: string; billing: { plan: string } }> }
  expect(reply.ok).toBe(true)
  expect(reply.result.length).toBeGreaterThan(0)
  // the demo organisation is nobody's customer; a flow's organisation is listed with its plan
  expect(reply.result.some((o) => o.name === 'Lumio AS')).toBe(false)
  expect(reply.result.every((o) => ['free', 'trial', 'team'].includes(o.billing.plan))).toBe(true)
  expect(JSON.stringify(reply)).not.toMatch(/answer|score|standing|profile|participa/i)

  const again = await call()
  expect(await again.json()).toEqual({ ok: false, error: 'replay' })
})

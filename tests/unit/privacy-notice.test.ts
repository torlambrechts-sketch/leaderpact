import { readdirSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadLegal } from '@/lib/site/legal'
import { SESSION_DAYS, SESSION_MAX_AGE } from '@/lib/supabase/cookies'
import { DRAFT_DAYS as SCAN_DRAFT_DAYS } from '@/lib/scan/draft'
import { SAVE_DAYS } from '@/lib/scan/device'
import { DRAFT_DAYS as PROFILE_DRAFT_DAYS, PENDING_DAYS } from '@/lib/profile/device'
import { ROUND_DRAFT_DAYS } from '@/lib/rounds/draft'
import { JOIN_DAYS } from '@/lib/group/device'

/**
 * The privacy notice (D-61) states figures the code enforces: how long a session, a cookie, a draft, a link and a
 * record last. Each is held here to its source, so a change to the code that the notice does not follow fails the
 * suite, and the notice never says what is no longer true.
 */
const notice = loadLegal('privacy')
const text = JSON.stringify(notice)
const read = (path: string) => readFileSync(path, 'utf8')
const migrations = readdirSync('supabase/migrations')
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => read(`supabase/migrations/${f}`))
  .join('\n')

describe('the privacy notice', () => {
  it('parses, carries its date, and names the processors the code uses', () => {
    expect(notice.h1).toBe('Privacy')
    expect(notice.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    for (const name of ['Supabase', 'Vercel', 'Brevo', 'Google', 'Microsoft', 'Frankfurt']) expect(text).toContain(name)
    expect(text).not.toContain('{product}')
  })

  it('states the session and cookie lifetimes the code sets', () => {
    expect(SESSION_DAYS).toBe(30)
    expect(text).toContain('30 days from your last visit')
    expect(read('app/(public)/templates/actions.ts')).toContain('maxAge: 60 * 60 * 24 * 365')
    expect(text).toContain('"1 year"')
  })

  it('states the range of the drafts kept in the browser', () => {
    const days = [SCAN_DRAFT_DAYS, SAVE_DAYS, PROFILE_DRAFT_DAYS, PENDING_DAYS, ROUND_DRAFT_DAYS, JOIN_DAYS]
    expect(text).toContain(`${Math.min(...days)} to ${Math.max(...days)} days, and removed when you finish`)
  })

  it('states the retention the database applies', () => {
    // the one default of the cancel window, never changed by a later migration
    expect([...migrations.matchAll(/'retention_after_cancel_days',\s*'organisation',\s*'(\d+)'/g)].map((m) => m[1])).toEqual(['90'])
    expect(migrations).not.toMatch(/update\s+app\.setting\b[^;]*retention_after_cancel_days/i)
    expect(text).toContain('90 days, then deleted')
    expect(migrations).toContain("app.group_last_seen(t.id) <= now() - interval '12 months'")
    expect(text).toContain('no sign-in for 12 months')
    expect(migrations).toContain("where a.at <= now() - interval '24 months'")
    expect(text).toContain('24 months, without your name')
    expect(migrations).toContain("link_expires_at = now() + interval '24 hours'")
    expect(migrations).toContain("e.requested_at < now() - interval '7 days'")
    expect(text).toContain('works once, for 24 hours. The file is deleted on download, or 7 days after you asked')
  })

  it("states what a Leader Profile's private link keeps and when it ends (D-66)", () => {
    // a fingerprint only, ended by a retake, and gone with the profile
    expect(migrations).toContain('token_hash bytea unique')
    expect(migrations).toContain('create trigger profile_link_retake')
    expect(migrations).toContain('person_id uuid primary key references app.personality_profile (person_id) on delete cascade')
    expect(text).toContain('We keep only a fingerprint of the link, never the link itself.')
    expect(text).toContain('It stops working when you turn it off, make a new one, take the test again or delete the profile.')
  })

  it('states the sign-in link and the threshold as they are set', () => {
    expect(read('supabase/config.toml')).toMatch(/^otp_expiry = 900$/m)
    expect(text).toContain('"15 minutes"')
    expect(migrations).toContain('create function app.k_floor() returns int\n  language sql immutable parallel safe\n  set search_path = \'\'\nas $$ select 4 $$;')
    expect(text).toContain('only with at least four answers')
  })
})

describe("the live meeting's browser client", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.doUnmock('@supabase/ssr')
  })

  it('writes its session cookies for 30 days, not the library default of 400', async () => {
    const written: string[] = []
    vi.stubGlobal('document', {
      get cookie() {
        return ''
      },
      set cookie(value: string) {
        written.push(value)
      },
    })
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    let options: { cookies?: { setAll: (list: { name: string; value: string; options: Record<string, unknown> }[]) => void } } = {}
    vi.doMock('@supabase/ssr', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@supabase/ssr')>()),
      createBrowserClient: (_url: string, _key: string, given: typeof options) => {
        options = given
        return {}
      },
    }))
    const { browserClient } = await import('@/lib/supabase/browser')
    expect(browserClient()).not.toBeNull()
    options.cookies?.setAll([
      { name: 'sb-ref-auth-token', value: 'base64-abc', options: { path: '/', sameSite: 'lax', maxAge: 400 * 86_400 } },
      { name: 'sb-ref-auth-token.1', value: '', options: { path: '/', maxAge: 0 } },
    ])
    expect(written[0]).toContain(`Max-Age=${SESSION_MAX_AGE}`)
    expect(written[1]).toContain('Max-Age=0')
  })
})

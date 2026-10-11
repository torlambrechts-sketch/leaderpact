import { afterEach, describe, expect, it, vi } from 'vitest'
import { readSupabaseEnv } from '@/lib/supabase/env'
import { LEADERPACT_PROJECT_REF } from '@/lib/supabase/project'

/**
 * The app uses LeaderPact's project or a local stack, and refuses any other: the cloud environment this
 * was built in held Orgpuls's production URL.
 */
afterEach(() => vi.unstubAllEnvs())
const withUrl = (url: string) => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', url)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'a-publishable-key')
  return readSupabaseEnv()
}

describe('readSupabaseEnv', () => {
  it("accepts LeaderPact's project", () => {
    expect(withUrl(`https://${LEADERPACT_PROJECT_REF}.supabase.co`)).toMatchObject({ url: `https://${LEADERPACT_PROJECT_REF}.supabase.co` })
  })

  it('accepts a local stack', () => {
    expect(withUrl('http://127.0.0.1:54321')).toHaveProperty('url')
    expect(withUrl('http://localhost:54321')).toHaveProperty('url')
  })

  it("refuses another product's project, by name", () => {
    const env = withUrl('https://jmhhszsnjfqgclxzhciq.supabase.co')
    expect(env).toHaveProperty('problem')
    expect('problem' in env && env.problem).toContain('jmhhszsnjfqgclxzhciq')
  })

  it('refuses any other host', () => {
    expect(withUrl('https://example.com')).toHaveProperty('problem')
  })

  it('still reports a missing variable first', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
    const env = readSupabaseEnv()
    expect('problem' in env && env.problem).toMatch(/not set/)
  })
})

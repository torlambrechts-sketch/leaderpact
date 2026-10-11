// Origin: Orgpuls tests/unit/helpers.test.ts @ 6f5d441 (adapted: without the one-organisation rule).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { PostgrestError } from '@supabase/supabase-js'
import { callFailed, parseFailed, readFailed } from '@/lib/supabase/read'
import { writeFailed } from '@/lib/supabase/write'

/**
 * The failure helpers. Each is the difference between a failure the product reports and a
 * failure it renders as the truth: a refused read shown as an empty list, a refused write shown as
 * "Saved". What they return, and what they refuse to log, is pinned here.
 */

const pgError = (over: Partial<PostgrestError> = {}): PostgrestError =>
  ({ name: 'PostgrestError', code: 'PGRST201', message: 'Could not embed', details: '', hint: '', ...over }) as PostgrestError

afterEach(() => vi.restoreAllMocks())
const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {})

describe('writeFailed', () => {
  it('a refused UPDATE comes back as zero rows and no error, and that is a failure', () => {
    const log = quiet()
    expect(writeFailed('saveCharter', null, [])).toBe(true)
    expect(log.mock.calls[0]?.[0]).toMatch(/\[write\] saveCharter: no row was affected/)
  })

  it('a missing representation is a failure too: a mutation without .select() cannot pass', () => {
    quiet()
    expect(writeFailed('saveCharter', null, null)).toBe(true)
  })

  it('an error is a failure, and is logged by code and message', () => {
    const log = quiet()
    expect(writeFailed('addMember', pgError({ code: '23505', message: 'duplicate key' }), null)).toBe(true)
    expect(log.mock.calls[0]?.[0]).toBe('[write] addMember: 23505 duplicate key')
  })

  it('one returned row is success, and logs nothing', () => {
    const log = quiet()
    expect(writeFailed('saveCharter', null, [{ id: 'x' }])).toBe(false)
    expect(log).not.toHaveBeenCalled()
  })

  it('never logs `details`, the field that quotes the value that violated a constraint', () => {
    const log = quiet()
    writeFailed('addMember', pgError({ details: 'Key (email)=(kari@lumio.example) already exists' }), null)
    expect(String(log.mock.calls[0]?.[0])).not.toContain('kari@lumio.example')
  })
})

describe('readFailed', () => {
  it('a refused embed is a failure, not an empty list', () => {
    const log = quiet()
    expect(readFailed('getRounds', pgError(), null)).toBe(true)
    expect(log.mock.calls[0]?.[0]).toMatch(/^\[read\] getRounds: PGRST201/)
  })

  it('a genuinely empty result is not a failure', () => {
    const log = quiet()
    expect(readFailed('getRounds', null, [])).toBe(false)
    expect(log).not.toHaveBeenCalled()
  })
})

describe('callFailed', () => {
  it('a null payload from an RPC is a legitimate answer, not a failure', () => {
    expect(callFailed('getResults', null)).toBe(false)
  })
})

describe('parseFailed', () => {
  it('logs the column and the code, never the value it received', () => {
    const log = quiet()
    const parsed = z.object({ body: z.number() }).safeParse({ body: 'something a person wrote' })
    expect(parseFailed('getAgenda', parsed)).toBe(true)
    const line = String(log.mock.calls[0]?.[0])
    expect(line).toContain('body [invalid_type]')
    expect(line).not.toContain('something a person wrote')
  })

  it('narrows the success arm, so no call site needs an assertion', () => {
    const parsed = z.object({ n: z.number() }).safeParse({ n: 1 })
    if (parseFailed('x', parsed)) throw new Error('unreachable')
    expect(parsed.data.n).toBe(1)
  })
})

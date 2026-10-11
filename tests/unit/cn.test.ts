import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/cn'

describe('cn', () => {
  it('lets the later of two conflicting classes win', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('keeps a custom font size and a text colour apart', () => {
    expect(cn('text-micro', 'text-ink')).toBe('text-micro text-ink')
  })
})

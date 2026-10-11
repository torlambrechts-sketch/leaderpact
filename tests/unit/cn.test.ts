import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/cn'
import config from '../../tailwind.config'

describe('cn', () => {
  it('lets the later of two conflicting classes win', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('keeps a custom font size and a text colour apart', () => {
    expect(cn('text-micro', 'text-ink')).toBe('text-micro text-ink')
  })

  it('knows every radius of the scale, so the later one wins', () => {
    const radii = Object.keys(config.theme?.extend?.borderRadius ?? {})
    expect(radii.length).toBeGreaterThan(0)
    for (const r of radii) {
      const other = r === 'pill' ? 'chip' : 'pill'
      expect(cn(`rounded-${other}`, `rounded-${r}`)).toBe(`rounded-${r}`)
    }
  })
})

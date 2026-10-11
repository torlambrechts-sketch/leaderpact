import { describe, expect, it } from 'vitest'
import { AVATAR_PAIRS, avatarPair, initials } from '@/components/lp/avatar-colours'
import { levelText, levelWidth } from '@/components/lp/level'

describe('avatar colours', () => {
  it('a person keeps the same pair', () => {
    expect(avatarPair('person-1')).toEqual(avatarPair('person-1'))
  })

  it('every pair comes from the handoff table', () => {
    const pairs = new Set(AVATAR_PAIRS.map(([b, c]) => `${b}/${c}`))
    for (const id of ['a', 'b', 'kari', 'ola', 'x'.repeat(40)]) {
      const { background, color } = avatarPair(id)
      expect(pairs.has(`${background}/${color}`)).toBe(true)
    }
  })

  it('spreads people across the pairs', () => {
    const used = new Set(Array.from({ length: 64 }, (_, i) => avatarPair(`person-${i}`).background))
    expect(used.size).toBeGreaterThanOrEqual(6)
  })

  it('initials: first and last word', () => {
    expect(initials('Kari Nordmann')).toBe('KN')
    expect(initials('  Ola  ')).toBe('O')
    expect(initials('Anne Marie Berg')).toBe('AB')
    expect(initials('')).toBe('')
  })
})

describe('level bar', () => {
  it('width is (level − 1) ÷ 4, clamped', () => {
    expect(levelWidth(1)).toBe(0)
    expect(levelWidth(3)).toBe(0.5)
    expect(levelWidth(5)).toBe(1)
    expect(levelWidth(0)).toBe(0)
    expect(levelWidth(9)).toBe(1)
    expect(levelWidth(Number.NaN)).toBe(0)
  })

  it('one decimal, British format', () => {
    expect(levelText(3.85)).toBe('3.9')
    expect(levelText(4)).toBe('4.0')
  })
})

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildScan, firstUnanswered, isComplete, personalView, type ItemRow, type Scan } from '@/lib/scan/model'
import { DRAFT_DAYS, DRAFT_KEY, forget, readDraft, writeDraft } from '@/lib/scan/draft'

/**
 * The scan on the visitor's device (handoff 6.2 and 6.3): the scan built from its rows, the personal view's
 * theme scores, and the draft that stays on the device and resumes for 7 days.
 */
const THEMES = ['purpose', 'meetings', 'dialogue', 'one_team', 'safety', 'results']
const VERSION = { id: randomUUID(), version: 1 }

function rows(): ItemRow[] {
  return THEMES.flatMap((key, t) =>
    [0, 1].map((k) => ({
      ordinal: t * 2 + k + 1,
      theme: { key, name: { en: `Theme ${key}` }, ordinal: t + 1 },
      item: { id: randomUUID(), text: { en: `Statement ${t * 2 + k + 1}.` } },
    })),
  )
}

function scanOf(r: ItemRow[] = rows()): Scan {
  const scan = buildScan(VERSION, r)
  if ('problem' in scan) throw new Error(scan.problem)
  return scan
}

/** answers for every item, by 1-based ordinal */
const answer = (scan: Scan, values: number[]) => Object.fromEntries(scan.items.map((item, i) => [item.id, values[i] as number]))

class MemoryStore {
  map = new Map<string, string>()
  getItem = (k: string) => this.map.get(k) ?? null
  setItem = (k: string, v: string) => void this.map.set(k, v)
  removeItem = (k: string) => void this.map.delete(k)
}

const refusing = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
  removeItem: () => {
    throw new Error('SecurityError')
  },
}

describe('buildScan', () => {
  it('orders the items and themes and keeps the wording of the rows', () => {
    const shuffled = rows().reverse()
    const scan = scanOf(shuffled)
    expect(scan.items.map((i) => i.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(scan.themes.map((t) => t.key)).toEqual(THEMES)
    expect(scan.items[0]?.text).toBe('Statement 1.')
    expect(scan.versionId).toBe(VERSION.id)
  })

  it('refuses a version that breaks Appendix C rather than showing it half right', () => {
    const gap = rows()
    gap[11]!.ordinal = 13
    expect(buildScan(VERSION, gap)).toEqual({ problem: 'the items are not numbered 1 to n' })

    const twice = rows()
    twice[1]!.item.id = twice[0]!.item.id
    expect(buildScan(VERSION, twice)).toEqual({ problem: 'an item is asked twice' })

    const three = rows()
    three[2]!.theme = { ...three[0]!.theme }
    expect(buildScan(VERSION, three)).toEqual({ problem: 'a theme is not asked by exactly two items' })

    expect(buildScan(VERSION, [])).toEqual({ problem: 'the published scan version has no items' })
  })

  it('builds from the committed data: twelve items, six themes, two each, in Appendix C order', () => {
    const data = JSON.parse(readFileSync('data/instrument/scan.v1.json', 'utf8')) as {
      themes: { key: string; name: string; ordinal: number }[]
      items: { order: number; theme: string; code: string }[]
    }
    const fromData: ItemRow[] = data.items.map((i) => {
      const theme = data.themes.find((t) => t.key === i.theme)!
      return { ordinal: i.order, theme: { key: theme.key, name: { en: theme.name }, ordinal: theme.ordinal }, item: { id: randomUUID(), text: { en: i.code } } }
    })
    const scan = scanOf(fromData)
    expect(scan.items).toHaveLength(12)
    expect(scan.themes.map((t) => t.name)).toEqual([
      'Purpose and priorities',
      'Meetings',
      'Dialogue and conflict',
      'Working as one team',
      'Safety and trust',
      'Results',
    ])
  })
})

describe('the personal view', () => {
  const scan = scanOf()

  it('is the mean of each theme’s two answers, half up to one decimal, in the themes’ order', () => {
    const view = personalView(scan, answer(scan, [3, 4, 1, 2, 5, 5, 1, 1, 2, 3, 4, 5]))
    expect(view?.map((t) => [t.key, t.tenths])).toEqual([
      ['purpose', 35],
      ['meetings', 15],
      ['dialogue', 50],
      ['one_team', 10],
      ['safety', 25],
      ['results', 45],
    ])
  })

  it('does not exist until every item has an answer', () => {
    const answers = answer(scan, [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3])
    delete answers[scan.items[11]!.id]
    expect(personalView(scan, answers)).toBeNull()
    expect(isComplete(scan, answers)).toBe(false)
    expect(firstUnanswered(scan, answers)).toBe(11)
    expect(firstUnanswered(scan, {})).toBe(0)
    expect(firstUnanswered(scan, answer(scan, Array(12).fill(2)))).toBe(11)
  })

  it('counts only answers from 1 to 5', () => {
    expect(isComplete(scan, answer(scan, [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6]))).toBe(false)
    expect(isComplete(scan, answer(scan, [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2.5]))).toBe(false)
  })
})

describe('the draft on the device', () => {
  const scan = scanOf()
  const now = new Date('2026-10-12T10:00:00Z')
  const later = (ms: number) => new Date(now.getTime() + ms)
  const DAY = 86_400_000

  it('comes back as it was saved', () => {
    const store = new MemoryStore()
    const answers = { [scan.items[0]!.id]: 4, [scan.items[1]!.id]: 2 }
    expect(writeDraft(store, scan, { answers, position: 2 }, now)).toBe(true)
    expect(readDraft(store, scan, later(DAY))).toEqual({ answers, position: 2 })
  })

  it('resumes for 7 days from the last save, then is removed', () => {
    const store = new MemoryStore()
    writeDraft(store, scan, { answers: {}, position: 0 }, now)
    expect(readDraft(store, scan, later(DRAFT_DAYS * DAY))).not.toBeNull()
    expect(readDraft(store, scan, later(DRAFT_DAYS * DAY + 1))).toBeNull()
    expect(store.map.has(DRAFT_KEY)).toBe(false)
  })

  it('is not resumed for another version of the scan, nor from the future', () => {
    const store = new MemoryStore()
    writeDraft(store, scan, { answers: {}, position: 0 }, now)
    expect(readDraft(store, { ...scan, versionId: randomUUID() }, now)).toBeNull()
    expect(store.map.has(DRAFT_KEY)).toBe(false)

    writeDraft(store, scan, { answers: {}, position: 0 }, later(DAY))
    expect(readDraft(store, scan, now)).toBeNull()
  })

  it('is parsed, not trusted: a broken record is removed, and answers to items not asked are dropped', () => {
    const store = new MemoryStore()
    store.setItem(DRAFT_KEY, '{not json')
    expect(readDraft(store, scan, now)).toBeNull()
    expect(store.map.has(DRAFT_KEY)).toBe(false)

    const record = { v: 1, version: scan.versionId, answers: { [scan.items[0]!.id]: 6 }, position: 0, savedAt: now.toISOString() }
    store.setItem(DRAFT_KEY, JSON.stringify(record))
    expect(readDraft(store, scan, now)).toBeNull()

    const stray = randomUUID()
    store.setItem(DRAFT_KEY, JSON.stringify({ ...record, answers: { [scan.items[0]!.id]: 5, [stray]: 3 }, position: 40 }))
    expect(readDraft(store, scan, now)).toEqual({ answers: { [scan.items[0]!.id]: 5 }, position: 11 })
  })

  it('goes on without resuming where the device refuses storage', () => {
    expect(readDraft(refusing, scan, now)).toBeNull()
    expect(writeDraft(refusing, scan, { answers: {}, position: 0 }, now)).toBe(false)
    expect(() => forget(refusing)).not.toThrow()
    expect(readDraft(null, scan, now)).toBeNull()
  })
})

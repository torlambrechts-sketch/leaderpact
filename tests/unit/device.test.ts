import { describe, expect, it } from 'vitest'
import { SAVE_DAYS, SAVE_KEY, forgetSave, readReplaceKey, readSave, replaceStoreKey, writeReplaceKey, writeSave } from '@/lib/scan/device'
import { DRAFT_KEY, joinDraftKey } from '@/lib/scan/draft'

/**
 * What the device keeps beside the draft (handoff 6.3 and 6.5): the save card's group across the email
 * sign-in, and one replace key per invite link. Parsed when read, dropped when unreadable, and never an
 * answer, an address or a person id.
 */
function memory(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  }
}
const refusing: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => {
    throw new Error('blocked')
  },
  key: () => null,
  removeItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

const SAVE = { name: 'Lumio leadership group', size: 8, request: '9b2f6c1e-3a4d-4c5b-8e6f-7a8b9c0d1e2f' }
const CODE = 'lumioLeadershipScan00001'
const KEY = 'A'.repeat(43)
const now = new Date('2026-10-12T10:00:00Z')
const days = (n: number) => new Date(now.getTime() + n * 86_400_000)

describe('the save card on the device', () => {
  it('keeps the group name, size and request id, and nothing else', () => {
    const store = memory()
    expect(writeSave(store, SAVE, now)).toBe(true)
    expect(Object.keys(JSON.parse(store.map.get(SAVE_KEY)!)).sort()).toEqual(['name', 'request', 'savedAt', 'size', 'v'])
    expect(readSave(store, now)).toEqual(SAVE)
  })

  it(`lasts ${SAVE_DAYS} days, then is removed when read`, () => {
    const store = memory()
    writeSave(store, SAVE, now)
    expect(readSave(store, days(SAVE_DAYS))).toEqual(SAVE)
    expect(readSave(store, days(SAVE_DAYS + 1))).toBeNull()
    expect(store.map.has(SAVE_KEY)).toBe(false)
  })

  it('drops an unreadable record, or one with a size outside 4 to 15', () => {
    const store = memory()
    store.setItem(SAVE_KEY, '{not json')
    expect(readSave(store, now)).toBeNull()
    expect(store.map.has(SAVE_KEY)).toBe(false)
    store.setItem(SAVE_KEY, JSON.stringify({ v: 1, ...SAVE, size: 3, savedAt: now.toISOString() }))
    expect(readSave(store, now)).toBeNull()
  })

  it('says so when the device refuses, and forgets on request', () => {
    expect(writeSave(refusing, SAVE, now)).toBe(false)
    expect(readSave(refusing, now)).toBeNull()
    const store = memory()
    writeSave(store, SAVE, now)
    forgetSave(store)
    expect(readSave(store, now)).toBeNull()
  })
})

describe('the replace key', () => {
  it('is kept per link, and a null key removes it', () => {
    const store = memory()
    expect(writeReplaceKey(store, CODE, KEY)).toBe(true)
    expect(readReplaceKey(store, CODE)).toBe(KEY)
    expect(readReplaceKey(store, 'anotherScanCodeAnother01')).toBeNull()
    writeReplaceKey(store, CODE, null)
    expect(store.map.has(replaceStoreKey(CODE))).toBe(false)
  })

  it('refuses a malformed code or key', () => {
    const store = memory()
    expect(writeReplaceKey(store, 'short', KEY)).toBe(false)
    store.setItem(replaceStoreKey(CODE), JSON.stringify({ v: 1, key: 'not a key' }))
    expect(readReplaceKey(store, CODE)).toBeNull()
  })

  it("is not the public scan's draft: each link has its own draft record", () => {
    expect(joinDraftKey(CODE)).not.toBe(DRAFT_KEY)
    expect(joinDraftKey(CODE)).not.toBe(joinDraftKey('anotherScanCodeAnother01'))
    expect(replaceStoreKey(CODE)).not.toBe(joinDraftKey(CODE))
  })
})

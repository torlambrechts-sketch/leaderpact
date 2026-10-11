/**
 * The eight avatar pairs (handoff section 4), background then text, picked by a stable hash of the
 * person, so a person keeps their colour on every screen and in every session. The hash is FNV-1a over
 * the person's id; nothing about the person is derived from the colour.
 */
export const AVATAR_PAIRS = [
  ['#ffe2cf', '#7a3a12'],
  ['#e4ecff', '#25407a'],
  ['#e6f5e9', '#22603a'],
  ['#cccbdc', '#3a3950'],
  ['#fde3f0', '#8a2459'],
  ['#fff1c9', '#6b5208'],
  ['#e3f4f7', '#1f5b66'],
  ['#eeeaf3', '#4d4659'],
] as const

export function avatarPair(personId: string): { background: string; color: string } {
  let hash = 0x811c9dc5
  for (let i = 0; i < personId.length; i++) {
    hash ^= personId.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  const [background, color] = AVATAR_PAIRS[hash % AVATAR_PAIRS.length]!
  return { background, color }
}

/** Up to two initials from a display name: the first letters of the first and last words. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const first = words[0]!.charAt(0)
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : ''
  return (first + last).toLocaleUpperCase('en-GB')
}

import { describe, expect, it } from 'vitest'
import { americanisms, copyFindings, emoji, forbiddenNames, longSentences } from '@/lib/i18n/copy-rules'

describe('copy rules (handoff section 10)', () => {
  it('British spelling', () => {
    expect(americanisms('Choose a color for your organization')).toHaveLength(2)
    expect(americanisms('Choose a colour for your organisation')).toEqual([])
  })

  it('no emoji, but arrows and dashes are fine', () => {
    expect(emoji('Well done 🎉')).toHaveLength(1)
    expect(emoji('Next → step – done')).toEqual([])
  })

  it('sentences under 25 words', () => {
    const long = Array.from({ length: 25 }, (_, i) => `w${i}`).join(' ') + '.'
    expect(longSentences(long)).toHaveLength(1)
    expect(longSentences('Short one. Another short one.')).toEqual([])
  })

  it('one name per thing', () => {
    expect(forbiddenNames('Take the Team Scan')).toHaveLength(1)
    expect(forbiddenNames('Take the Leadership Team Scan')).toEqual([])
    expect(forbiddenNames('A validated instrument')).toHaveLength(1)
    expect(forbiddenNames('Research-based, not yet validated')).toEqual([])
    expect(forbiddenNames('All 24 scales')).toHaveLength(1)
  })

  it('the lead of the landing page passes', () => {
    expect(copyFindings('A research-based reading of your team in minutes. Invite your group to one shared, anonymous picture, then improve it meeting by meeting.')).toEqual([])
  })
})

import 'server-only'
import { getTranslations } from 'next-intl/server'
import { levelText } from '@/components/lp/level'
import type { ScaleRowLabels } from '@/components/results/ScaleRows'
import type { ResultChange } from '@/lib/results/build'
import { STANDINGS } from '@/lib/scoring'

/** The words the results pages share: the row labels, and a change in words or as a signed number */
export async function resultLabels() {
  const [t, tAgree, tStanding, tEvidence] = await Promise.all([
    getTranslations('results'),
    getTranslations('agreement'),
    getTranslations('standing'),
    getTranslations('evidence'),
  ])
  const rows: ScaleRowLabels = {
    reading: { higher: t('reading_higher'), lower: t('reading_lower'), descriptive: t('reading_descriptive'), conditional: t('reading_conditional') },
    evidence: (e) => tEvidence(e ?? 'self_rated'),
    agreement: { high: tAgree('high'), medium: tAgree('medium'), low: tAgree('low') },
    standing: Object.fromEntries(STANDINGS.map((s) => [s, tStanding(s)])) as ScaleRowLabels['standing'],
    levelWords: (level) => t('levelWords', { level }),
    changeWords: (change) => t('changeWords', { change }),
    columns: {
      scale: t('colScale'),
      evidence: t('colEvidence'),
      level: t('colLevel'),
      change: t('colChange'),
      agreement: t('colAgreement'),
      standing: t('colStanding'),
    },
  }
  const change = (c: ResultChange) =>
    c.kind === 'shown'
      ? `${c.deltaTenths > 0 ? '+' : '−'}${levelText(Math.abs(c.deltaTenths) / 10)}`
      : c.kind === 'within'
        ? t('within')
        : c.kind === 'first'
          ? t('firstRound')
          : t('notComparable')
  return { t, rows, change }
}

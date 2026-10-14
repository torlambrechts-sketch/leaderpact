import 'server-only'
import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/lp/Card'
import { Pill } from '@/components/lp/Pill'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { agreementsWaiting } from '@/lib/pulses/build'
import type { Pulses } from '@/lib/pulses/schema'

/**
 * What the next pulse asks (handoff 6.16, design `assess` pulse tab): its questions in the order it is built,
 * each with where it comes from — a focus area's scale, a working agreement, or a rotating item from another
 * scale — read from the database's own builder (`get_pulses`, 0020), so the list is what would open now. No
 * answer, no count and no level: a pulse shows nothing before it closes.
 */
export async function NextPulse({ pulses }: { pulses: Pulses }) {
  const t = await getTranslations('pulses')
  const waiting = agreementsWaiting(pulses)
  return (
    <Card large className="flex flex-col gap-3">
      <SectionHeader title={t('nextTitle')} meta={t('nextMeta', { count: pulses.next.length, max: pulses.max_questions })} />
      <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('builtOrder', { rotating: pulses.max_rotating, max: pulses.max_questions })}</p>
      {pulses.focus === 0 && <p className="m-0 text-[13.5px] font-semibold max-md:text-[15px]">{t('noFocus')}</p>}
      <ol aria-label={t('nextTitle')} className="m-0 flex list-none flex-col p-0">
        {pulses.next.map((q, i) => (
          <li key={`${q.source}-${i}`} className="flex items-start gap-3 border-t border-divider py-2.5">
            <span aria-hidden className="w-5 shrink-0 pt-0.5 text-right text-[12.5px] font-bold text-muted">
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[13.5px] leading-[1.45] [overflow-wrap:anywhere] max-md:text-[15px]">{q.text}</span>
              <Pill tone={q.source === 'focus' ? 'accent' : 'neutral'} className="self-start whitespace-normal">
                {q.source === 'focus' ? t('fromFocus', { scale: q.scale ?? '' }) : q.source === 'agreement' ? t('fromAgreement') : t('fromRotating', { scale: q.scale ?? '' })}
              </Pill>
            </div>
          </li>
        ))}
      </ol>
      {waiting > 0 && <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('waiting', { count: waiting })}</p>}
      <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('builtWhenOpens')}</p>
    </Card>
  )
}

import 'server-only'
import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/lp/Card'
import { Pill } from '@/components/lp/Pill'
import { dayWords } from '@/lib/live/build'
import type { Live } from '@/lib/live/schema'

/**
 * The end of a meeting (handoff 6.15: "a summary of items, decisions and new actions"): each item as it closed,
 * or not reached, with its decision and the actions it made; then the parking lot. Process comments are gone
 * with the meeting (handoff 8), so the summary has none.
 */
export async function LiveSummary({ live, agendaHref }: { live: Live; agendaHref: string }) {
  const t = await getTranslations('live')
  const actions = live.items.reduce((n, i) => n + i.actions.length, 0)
  const decisions = live.items.filter((i) => i.decision).length
  return (
    <div className="flex flex-col gap-5">
      <Card large className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 text-[20px] font-bold">{live.meeting.title}</h2>
          <Pill tone="neutral">{t('heldPill')}</Pill>
        </div>
        <p className="m-0 text-[14px] text-text-2 max-md:text-[15px]">{t('summaryLead', { items: live.items.length, decisions, actions })}</p>
        <Link href={agendaHref as Route} className="self-start text-[13px] font-semibold text-ink underline underline-offset-2 max-md:min-h-[44px] max-md:text-[15px]">
          {t('toAgenda')}
        </Link>
      </Card>
      <ol aria-label={t('summaryItems')} className="m-0 flex list-none flex-col gap-3 p-0">
        {live.items.map((item, i) => (
          <li key={item.id}>
            <Card large className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="m-0 text-[16px] font-bold">{t('numbered', { n: i + 1, title: item.title })}</h3>
                <Pill tone={item.closed_as === 'reached' ? 'ok' : 'neutral'}>{item.closed_as ? t(`state_${item.closed_as}`) : t('notReached')}</Pill>
              </div>
              <p className="m-0 text-[14px] max-md:text-[15px]">
                <span className="font-semibold">{t('decisionTitle')}: </span>
                {item.decision ?? t('noDecision')}
              </p>
              {item.actions.length > 0 && (
                <ul aria-label={t('actionsOf', { title: item.title })} className="m-0 list-none p-0">
                  {item.actions.map((a) => (
                    <li key={a.id} className="border-t border-divider py-2 text-[13.5px] first:border-t-0 max-md:text-[15px]">
                      <span className="font-semibold">{a.title}</span>
                      <span className="text-text-2"> · {t('actionMeta', { owner: a.owner_name, due: dayWords(a.due_on) })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </li>
        ))}
      </ol>
      <Card large className="flex flex-col gap-2">
        <h2 className="m-0 text-[16px] font-bold">{t('parkingTitle')}</h2>
        {live.parking.length === 0 ? (
          <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('noParking')}</p>
        ) : (
          <ul aria-label={t('parkingTitle')} className="m-0 list-none p-0">
            {live.parking.map((p) => (
              <li key={p.id} className="border-t border-divider py-2 text-[14px] first:border-t-0 max-md:text-[15px]">
                {p.text}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

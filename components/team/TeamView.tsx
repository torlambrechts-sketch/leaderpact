import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { Check, Info, Split } from 'lucide-react'
import { LevelBar } from '@/components/lp/LevelBar'
import { buttonVariants } from '@/components/ui/button'
import type { TeamView as View } from '@/lib/scan/team-view'

/**
 * The team view (handoff 6.6, design `team`): per theme the level and the agreement label, computed once at
 * close; "You agree on" and "Your views differ most on"; and the card on what the Team plan adds. Never a
 * score of a person, a spread, a lowest or highest, or the agreement number (handoff 7).
 *
 * On the Free plan the leader sees the Team plan's price and Upgrade (handoff 6.19); anyone else, the link's
 * readers included, is asked to ask their team leader. A group with the Team plan sees neither (D-33). Two
 * columns from 900 px, one below.
 */
export async function TeamView({
  groupName,
  view,
  total,
  audience,
  price,
  upgradeHref,
  upsell = true,
}: {
  groupName: string
  view: View
  total: number
  audience: 'leader' | 'member'
  /** the Team plan's price, formatted; shown to the leader only */
  price: string | null
  /** the checkout, for the leader on the Free plan */
  upgradeHref?: string
  /** false once the group has the Team plan */
  upsell?: boolean
}) {
  const t = await getTranslations('teamView')
  const tAgree = await getTranslations('agreement')
  return (
    <div className="mx-auto mt-6 flex max-w-[1080px] flex-col gap-5 px-4 md:mt-9 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{groupName}</p>
          <h1 className="m-0 font-display text-greeting max-md:text-[28px]">{t('heading')}</h1>
        </div>
        <p className="sr-only">{t('answeredWords', { answered: view.answered, total })}</p>
        <span aria-hidden className="rounded-pill bg-accent px-3 py-1.5 text-[13px] font-semibold text-accent-ink">
          {t('answered', { answered: view.answered, total })}
        </span>
      </div>

      <div className="grid items-start gap-5 min-[900px]:grid-cols-[minmax(0,1fr)_280px]">
        <section aria-label={t('themesLabel')} className="flex flex-col gap-4 rounded-card-lg border border-white bg-surface px-6 py-6 md:px-[30px] md:py-7">
          {view.themes.map((theme) => (
            <LevelBar key={theme.key} variant="team" label={theme.name} level={theme.tenths / 10} agreement={tAgree(theme.agreement)} />
          ))}
          <div className="flex flex-col gap-1 border-t border-rule-softer pt-3 text-[12px] leading-[1.5] text-muted max-md:text-[15px]">
            <p className="m-0">{t('label')}</p>
            <p className="m-0">{t('noOne')}</p>
            <p className="m-0">{t('computed')}</p>
          </div>
        </section>

        <div className="flex flex-col gap-2.5">
          <section className="flex flex-col gap-1 rounded-r16 border border-white bg-surface p-4">
            <h2 className="m-0 flex items-center gap-1.5 text-[11.5px] font-normal text-muted max-md:text-[15px]">
              <Check aria-hidden size={14} className="text-ink" />
              {t('agreeOn')}
            </h2>
            <p className="m-0 text-[15px] font-bold">{view.agreeOn.length ? view.agreeOn.join(', ') : t('agreeNone')}</p>
          </section>
          <section className="flex flex-col gap-1 rounded-r16 border border-white bg-surface p-4">
            <h2 className="m-0 flex items-center gap-1.5 text-[11.5px] font-normal text-muted max-md:text-[15px]">
              <Split aria-hidden size={14} className="text-ink" />
              {t('differOn')}
            </h2>
            <p className="m-0 text-[15px] font-bold">{view.differOn.length ? view.differOn.join(', ') : t('differNone')}</p>
            {view.differOn.length > 0 && <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('differHint')}</p>}
          </section>
        </div>
      </div>

      {!upsell ? null : audience === 'leader' ? (
        <section className="grid items-center gap-6 rounded-card-lg bg-ink px-6 py-6 text-white md:grid-cols-[minmax(0,1fr)_auto] md:px-8 md:py-7">
          <div className="flex flex-col gap-2">
            <h2 className="m-0 text-[20px] font-bold">{t('upsellTitle')}</h2>
            <p className="m-0 text-[14px] leading-[1.55] text-white/85 max-md:text-[15px]">{t('upsellBody')}</p>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            {price && <p className="m-0 text-[13px] text-white/80 max-md:text-[15px] md:text-right">{t('upsellPrice', { price })}</p>}
            {upgradeHref && (
              <Link href={upgradeHref as Route} className={buttonVariants({ variant: 'on-ink', className: 'self-start md:self-end' })}>
                {t('upgrade')}
              </Link>
            )}
          </div>
        </section>
      ) : (
        <section className="flex items-center gap-3.5 rounded-card-lg border border-white bg-surface px-[26px] py-[22px]">
          <Info aria-hidden size={20} className="shrink-0 text-ink" />
          <p className="m-0 text-[14px] max-md:text-[15px]">{t('ask')}</p>
        </section>
      )}
    </div>
  )
}

/** The page when a scan closed with fewer than k answers (handoff 6.6): no team view, and why */
export async function NoTeamView({ groupName }: { groupName: string }) {
  const t = await getTranslations('teamView')
  return (
    <div className="mx-auto mt-6 max-w-questionnaire px-4 md:mt-10 md:px-6">
      <section className="flex flex-col gap-3 rounded-card-lg border border-white bg-surface p-6 md:p-9">
        <p className="m-0 text-[13px] text-muted max-md:text-[15px]">{groupName}</p>
        <h1 className="m-0 font-display text-sub-headline">{t('noneTitle')}</h1>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('noneBody')}</p>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('noneWhy')}</p>
      </section>
    </div>
  )
}

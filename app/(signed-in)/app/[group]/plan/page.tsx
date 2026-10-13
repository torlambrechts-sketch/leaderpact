import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { CheckCircle2, Circle, Target } from 'lucide-react'
import { PageTitle } from '@/components/app/AppPage'
import { Avatar } from '@/components/lp/Avatar'
import { Card } from '@/components/lp/Card'
import { IconTile } from '@/components/lp/IconTile'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { SamplePage } from '@/components/sample/SamplePage'
import { sampleAvatarId, sampleDay } from '@/components/sample/format'
import { PRODUCT_NAME } from '@/lib/brand'
import { cn } from '@/lib/cn'
import { SAMPLE, SAMPLE_RESULTS, samplePerson } from '@/lib/sample/load'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('planTitle', { product: PRODUCT_NAME }) }
}

/**
 * Plan on the Free plan (handoff 6.13 and 6.19, design `develop`): the sample's focus areas and their
 * actions, each with an owner and a due date. Section 11's corrections: focus areas and actions only, so no
 * initiatives, milestones, timeline, business measure, linked practices or practices tab, and no target on
 * a survey score. Focus areas and actions are built in milestone 12.
 */
export default async function PlanPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const t = await getTranslations('sample')
  const scales = Object.values(SAMPLE_RESULTS).flat()
  const scaleName = (key: string) => scales.find((s) => s.key === key)?.name ?? key
  const { focus } = SAMPLE.plan
  return (
    <SamplePage group={group}>
      <PageTitle eyebrow={t('eyebrow', { group: SAMPLE.group })} title={t('plan.title')} />
      <div className="grid items-start gap-5 min-[960px]:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          {/* on the page's cream, the meta takes --text-2: --muted fails there (4.04:1) */}
          <SectionHeader title={t('plan.focusTitle')} meta={<span className="text-text-2">{t('plan.focusMeta', { count: focus.length })}</span>} className="mb-0" />
          {focus.map((area) => {
            const open = area.actions.filter((a) => !a.done).length
            return (
              <Card large key={area.scale} className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <IconTile icon={Target} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <h2 className="m-0 text-[17px] font-bold">{scaleName(area.scale)}</h2>
                    <p className="m-0 text-[13px] text-muted max-md:text-[15px]">
                      {t('plan.focusFrom', { round: t('results.roundName', { number: SAMPLE.results.round }), scale: scaleName(area.scale) })}
                    </p>
                  </div>
                </div>
                <SectionHeader as="h3" title={t('plan.actions')} meta={t('plan.actionsMeta', { open, done: area.actions.length - open })} className="mb-0 mt-1" />
                <ul className="m-0 list-none p-0">
                  {area.actions.map((action) => {
                    const owner = samplePerson(action.owner)
                    const Icon = action.done ? CheckCircle2 : Circle
                    return (
                      <li key={action.title} className="flex flex-wrap items-center gap-3 border-t border-divider py-3">
                        <Icon aria-hidden size={18} className={cn('shrink-0', action.done ? 'text-ink' : 'text-muted')} />
                        <span className="sr-only">{action.done ? t('plan.done') : t('plan.open')}</span>
                        <span className={cn('min-w-0 flex-1 text-[14px] max-md:text-[15px]', action.done && 'text-text-2 line-through')}>{action.title}</span>
                        <span className="flex items-center gap-2">
                          <Avatar personId={sampleAvatarId(owner.key)} name={owner.name} size={26} className="text-[10.5px]" />
                          <span className="sr-only">{t('plan.ownerWords', { name: owner.name })}</span>
                          <span className="w-[104px] text-[12.5px] text-muted max-md:text-[14px]">{t('plan.due', { date: sampleDay(action.due) })}</span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            )
          })}
        </div>
        <Card large className="flex flex-col gap-2.5">
          <h2 className="m-0 text-[16px] font-bold">{t('plan.rulesTitle')}</h2>
          <p className="m-0 text-[13.5px] leading-[1.5] text-text-2 max-md:text-[15px]">{t('plan.focusRule')}</p>
          <p className="m-0 text-[13.5px] leading-[1.5] text-text-2 max-md:text-[15px]">{t('plan.nextAgenda')}</p>
          <p className="m-0 text-[13.5px] leading-[1.5] text-text-2 max-md:text-[15px]">{t('plan.noTarget')}</p>
        </Card>
      </div>
    </SamplePage>
  )
}

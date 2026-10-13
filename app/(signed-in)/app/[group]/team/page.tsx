import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { NoTeamView, TeamView } from '@/components/team/TeamView'
import { HintBox } from '@/components/lp/HintBox'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadGroupTeamView } from '@/lib/groups/load'
import { dateFormat } from '@/lib/i18n/dates'
import { formatPrice, loadTeamPrice } from '@/lib/plans/load'
import { SIGN_IN_PATH, invitePath } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('teamTitle', { product: PRODUCT_NAME }) }
}

/**
 * The group's team view for its members (handoff 6.6, design `team`), in its three states: open, a count
 * and the closing date only (section 11: no countdown to 4); closed with 4 or more answers, the team view
 * computed at close; closed with fewer, a page that says no team view was made. Home carries it from
 * milestone 6.
 */
export default async function TeamPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const t = await getTranslations('teamView')
  const tInvite = await getTranslations('invite')
  const data = await loadGroupTeamView(group, user.id)

  if (data === null || data === 'none') {
    return (
      <Frame>
        <h1 className="m-0 font-display text-sub-headline">{data === null ? t('readFailed') : tInvite('notFoundTitle')}</h1>
        {data === 'none' && <p className="m-0 text-[15px] text-text-2">{tInvite('notFoundBody')}</p>}
      </Frame>
    )
  }

  const { scan } = data
  if (!scan) {
    return (
      <Frame>
        <p className="m-0 text-[13px] text-muted">{data.group.name}</p>
        <h1 className="m-0 font-display text-sub-headline">{tInvite('noScan')}</h1>
      </Frame>
    )
  }
  if (scan.phase === 'closed') return <NoTeamView groupName={data.group.name} />
  if (scan.phase === 'released') {
    if (!data.view) {
      return (
        <Frame>
          <h1 className="m-0 font-display text-sub-headline">{t('readFailed')}</h1>
        </Frame>
      )
    }
    const price = data.role === 'leader' ? await loadTeamPrice() : null
    return <TeamView groupName={data.group.name} view={data.view} total={scan.memberCount} audience={data.role} price={price ? formatPrice(price) : null} />
  }

  const date = dateFormat({ locale: 'en', timeZone: 'UTC' }, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(scan.closesAt))
  return (
    <Frame>
      <p className="m-0 text-[13px] text-muted max-md:text-[15px]">{data.group.name}</p>
      <h1 className="-mt-1 mb-0 font-display text-page-title max-md:text-[28px]">{t('heading')}</h1>
      <HintBox title={t('openTitle')}>
        {t('openBody', { answered: scan.answered, total: scan.memberCount, date })} {t('openCounts')}
      </HintBox>
      <Link href={invitePath(data.group.id) as Route} className="text-link self-start text-[15px] font-semibold text-ink underline underline-offset-2 max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
        {t('toInvite')}
      </Link>
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-6 max-w-[720px] px-4 md:mt-10 md:px-6">
      <section className="flex flex-col gap-4 rounded-card-lg border border-white bg-surface p-6 md:p-9">{children}</section>
    </div>
  )
}

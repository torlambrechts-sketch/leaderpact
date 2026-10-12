import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { PRODUCT_NAME } from '@/lib/brand'
import { dateFormat } from '@/lib/i18n/dates'
import { loadInviteByCode, loadScanVersion } from '@/lib/scan/load'
import { ScanUnavailable } from '@/app/(public)/scan/Unavailable'
import { JoinFlow } from './JoinFlow'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('joinTitle', { product: PRODUCT_NAME }) }
}

/**
 * A member answers from the group's invite link (handoff 6.5): no account, the 12 questions, their
 * personal view, then "Submit anonymously". The page says how answers are kept and when the team view
 * opens. Read through `get_scan_invite` (0009): the group's name, the count and the closing date, never a
 * score. A closed scan says so; its team view is milestone 5.
 */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const t = await getTranslations('join')
  const invite = await loadInviteByCode(code)

  if (invite === null) return <Message title={t('readFailed')} />
  if (invite === 'none') return <Message title={t('notFoundTitle')} body={t('notFoundBody')} />
  if (invite.phase !== 'open' || Date.parse(invite.closes_at) <= Date.now()) {
    const body =
      invite.phase === 'released'
        ? t('releasedBody', { answered: invite.answered })
        : invite.phase === 'closed'
          ? t('closedBody')
          : t('closedNow')
    return <Message eyebrow={invite.group_name} title={t('closedTitle')} body={body} />
  }

  const scan = await loadScanVersion(invite.instrument_version_id)
  if (!scan) return <ScanUnavailable />
  const closes = dateFormat({ locale: 'en', timeZone: 'UTC' }, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(invite.closes_at))

  return (
    <ClientMessages namespaces={['join', 'scan', 'result']}>
      <JoinFlow code={code} scan={scan} group={invite.group_name} answered={invite.answered} total={invite.member_count} closes={closes} />
    </ClientMessages>
  )
}

function Message({ eyebrow, title, body }: { eyebrow?: string; title: string; body?: string }) {
  return (
    <div className="mx-auto mt-6 max-w-questionnaire px-4 md:mt-10 md:px-6">
      <section className="flex flex-col gap-3 rounded-card-lg border border-white bg-surface p-6 md:p-9">
        {eyebrow && <p className="m-0 text-[13px] text-muted max-md:text-[15px]">{eyebrow}</p>}
        <h1 className="m-0 font-display text-sub-headline">{title}</h1>
        {body && <p className="m-0 text-[15px] leading-[1.55] text-text-2">{body}</p>}
      </section>
    </div>
  )
}

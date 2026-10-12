import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { ExternalLink } from 'lucide-react'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { HintBox } from '@/components/lp/HintBox'
import { WarningBox } from '@/components/lp/WarningBox'
import { buttonVariants } from '@/components/ui/button'
import { PRODUCT_NAME } from '@/lib/brand'
import { requestOrigin } from '@/lib/auth/origin'
import { currentUser } from '@/lib/auth/session'
import { loadInvite } from '@/lib/groups/load'
import { dateFormat } from '@/lib/i18n/dates'
import { cn } from '@/lib/cn'
import { SIGN_IN_PATH, joinPath } from '@/lib/routes'
import { CopyLink } from './CopyLink'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('inviteTitle', { product: PRODUCT_NAME }) }
}

/**
 * Invite and scan status (handoff 6.4, design `invite`): the group's one link, the count of answers and
 * the closing date. Never a score and never a name. With section 11's corrections: no "more answers
 * needed" countdown toward 4 and no "the team view opens at 4 answers"; the team view opens when the scan
 * closes. Reminders are not mentioned: none are sent yet. The leader cannot close the scan early.
 */
export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ group: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ group }, query] = await Promise.all([params, searchParams])
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const t = await getTranslations('invite')
  const view = await loadInvite(group, user.id)

  if (view === null || view === 'none') {
    return (
      <Frame>
        <h1 className="m-0 font-display text-sub-headline">{view === null ? t('readFailed') : t('notFoundTitle')}</h1>
        {view === 'none' && <p className="m-0 text-[15px] text-text-2">{t('notFoundBody')}</p>}
      </Frame>
    )
  }

  const { scan, code } = view
  const origin = await requestOrigin()
  const link = code ? `${origin ?? ''}${joinPath(code)}` : null
  const date = (iso: string) => dateFormat({ locale: 'en', timeZone: 'UTC' }, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso))

  return (
    <Frame>
      <p className="m-0 text-[13px] text-muted max-md:text-[15px]">{view.group.name}</p>
      <h1 className="-mt-3 mb-0 text-[30px] font-bold tracking-[-0.02em] max-md:text-[26px]">{t('heading')}</h1>

      {query.answers === 'missing' && <WarningBox>{t('answersMissing')}</WarningBox>}

      {!scan || !code ? (
        <p className="m-0 text-[15px] text-text-2">{t('noScan')}</p>
      ) : (
        <>
          {scan.phase === 'open' && link && (
            <ClientMessages namespaces={['invite']}>
              <CopyLink link={link} />
            </ClientMessages>
          )}

          <div className="flex flex-wrap items-end justify-between gap-5">
            <p className="sr-only">{t('countWords', { answered: scan.answered, total: scan.memberCount })}</p>
            <div aria-hidden className="flex flex-col gap-1">
              <span className="text-[52px] font-bold leading-none tracking-[-0.03em] max-md:text-[44px]">
                {t('count', { answered: scan.answered, total: scan.memberCount })}
              </span>
              <span className="text-[13.5px] text-muted max-md:text-[15px]">{t('countCaption')}</span>
            </div>
            <div aria-hidden data-part="dots" className="flex max-w-[260px] flex-wrap justify-end gap-[5px]">
              {Array.from({ length: scan.memberCount }, (_, i) => (
                <span key={i} data-part={i < scan.answered ? 'dot-on' : 'dot-off'} className={cn('h-[22px] w-[22px] rounded-[7px]', i < scan.answered ? 'bg-ink' : 'bg-line')} />
              ))}
            </div>
          </div>

          {scan.phase === 'open' && (
            <>
              <HintBox title={t('openTitle')}>
                {t('openBody', { total: scan.memberCount, date: date(scan.closesAt) })}
                {scan.extended && ` ${t('extended')}`}
              </HintBox>
              <p className="m-0 text-[14px] leading-[1.55] text-text-2 max-md:text-[15px]">{t('share')}</p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={joinPath(code) as Route} target="_blank" className={buttonVariants({ variant: 'secondary', className: 'gap-2' })}>
                  {t('openLink')}
                  <ExternalLink aria-hidden size={15} />
                </Link>
                <span className="text-[13px] text-muted max-md:text-[15px]">{t('openLinkHint')}</span>
              </div>
            </>
          )}
          {scan.phase === 'released' && (
            <HintBox title={t('releasedTitle')}>{t('releasedBody', { answered: scan.answered, total: scan.memberCount })}</HintBox>
          )}
          {scan.phase === 'closed' && <HintBox title={t('closedTitle')}>{t('closedBody')}</HintBox>}
        </>
      )}
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-6 max-w-[720px] px-4 md:mt-10 md:px-6">
      <section className="flex flex-col gap-5 rounded-card-lg border border-white bg-surface p-6 md:p-9">{children}</section>
    </div>
  )
}

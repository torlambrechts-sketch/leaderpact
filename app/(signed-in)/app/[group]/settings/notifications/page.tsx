import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageProblem } from '@/components/app/AppPage'
import { SettingsFrame } from '@/components/app/SettingsFrame'
import { Card } from '@/components/lp/Card'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { SummaryForm } from '@/components/settings/SettingsActions'
import { PRODUCT_NAME } from '@/lib/brand'
import { loadNotifications } from '@/lib/account/load'
import { currentUser } from '@/lib/auth/session'
import { loadShell } from '@/lib/groups/load'
import { SIGN_IN_PATH, accountPath } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('notificationsTitle', { product: PRODUCT_NAME }) }
}

/**
 * Notifications (handoff 6.18): each person sets how often their summary arrives (0022), and sees the mail that
 * always comes, each to them alone. A reminder never says who has not answered. The design's six switches are
 * not built: the handoff asks for the summary's frequency, and an invitation or reminder belongs to the
 * questionnaire it asks for (D-53).
 */
export default async function NotificationsPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const [t, tInvite] = await Promise.all([getTranslations('settings'), getTranslations('invite')])
  const [shell, mine] = await Promise.all([loadShell(group, user.id), loadNotifications()])
  if (shell === null) return <PageProblem title={tInvite('readFailed')} />
  if (shell === 'none') return <PageProblem title={tInvite('notFoundTitle')} body={tInvite('notFoundBody')} />

  return (
    <ClientMessages namespaces={['settings']}>
      <SettingsFrame group={{ id: group, name: shell.current.name }} active="notifications">
        <Card large className="flex flex-col gap-3">
          <SectionHeader title={t('notificationsTitle')} meta={t('notificationsMeta')} className="mb-1" />
          {mine ? (
            <>
              <SummaryForm summary={mine.summary} timeZone={mine.timeZone} />
              <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('summaryNote')}</p>
              <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">
                {t('summaryZone', { zone: (mine.timeZone ?? 'UTC').replaceAll('_', ' ') })}{' '}
                <Link href={accountPath(group) as Route} className="font-semibold underline underline-offset-2">
                  {t('summaryZoneLink')}
                </Link>
              </p>
            </>
          ) : (
            <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
              {t('readFailed')}
            </p>
          )}
        </Card>
        <Card large className="flex flex-col gap-3">
          <SectionHeader title={t('alwaysTitle')} meta={t('alwaysMeta')} className="mb-1" />
          <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[14px] leading-[1.55] max-md:text-[15px]">
            <li>{t('alwaysInvite')}</li>
            <li>{t('alwaysReminder')}</li>
            <li>{t('alwaysExport')}</li>
          </ul>
        </Card>
      </SettingsFrame>
    </ClientMessages>
  )
}

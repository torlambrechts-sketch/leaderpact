import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { Mail } from 'lucide-react'
import { PageProblem } from '@/components/app/AppPage'
import { SettingsFrame } from '@/components/app/SettingsFrame'
import { Avatar } from '@/components/lp/Avatar'
import { Card } from '@/components/lp/Card'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { DeleteAccount, SignOutEverywhere, TimeZoneForm } from '@/components/settings/SettingsActions'
import { PRODUCT_NAME } from '@/lib/brand'
import { loadNotifications, timeZones } from '@/lib/account/load'
import { currentUser } from '@/lib/auth/session'
import { loadShell } from '@/lib/groups/load'
import { SIGN_IN_PATH } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('accountTitle', { product: PRODUCT_NAME }) }
}

const row = 'flex flex-col gap-3 border-t border-line py-4 first:border-t-0 first:pt-0'

/**
 * Account (handoff 6.18, design `settings` account tab): who is signed in, the address and how they sign in,
 * the time zone their summary follows, sign out everywhere, and delete account. English is the only language,
 * so there is no language picker; the design's session list is left out, since nothing records sessions by
 * place (D-53). The address is shown, not edited.
 */
export default async function AccountPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const [t, tInvite] = await Promise.all([getTranslations('settings'), getTranslations('invite')])
  const [shell, mine] = await Promise.all([loadShell(group, user.id), loadNotifications()])
  if (shell === null) return <PageProblem title={tInvite('readFailed')} />
  if (shell === 'none') return <PageProblem title={tInvite('notFoundTitle')} body={tInvite('notFoundBody')} />

  return (
    <ClientMessages namespaces={['settings']}>
      <SettingsFrame group={{ id: group, name: shell.current.name }} active="account">
        <Card large className="flex flex-col">
          <SectionHeader title={t('accountTitle')} meta={t('accountMeta')} className="mb-4" />
          <div className={row}>
            <div className="flex items-center gap-3">
              <Avatar personId={shell.person.id} name={shell.person.name} size={52} className="text-[15px]" />
              <div className="flex min-w-0 flex-col">
                <span className="break-words text-[16px] font-bold">{shell.person.name}</span>
                <span className="text-[13px] text-text-2 max-md:text-[15px]">
                  {shell.current.role === 'leader' ? t('roleLeader') : t('roleMember')} · {shell.current.name}
                </span>
              </div>
            </div>
          </div>
          <dl className={`${row} m-0 grid gap-4 sm:grid-cols-2`}>
            <div className="flex flex-col gap-1">
              <dt className="text-[12.5px] font-semibold text-text-2 max-md:text-[15px]">{t('emailLabel')}</dt>
              <dd className="m-0 break-words text-[14.5px] max-md:text-[15px]">{user.email}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[12.5px] font-semibold text-text-2 max-md:text-[15px]">{t('signInLabel')}</dt>
              <dd className="m-0 flex items-center gap-2 text-[14.5px] max-md:text-[15px]">
                <Mail aria-hidden size={15} />
                {t('signInBody')}
              </dd>
            </div>
          </dl>
          <div className={row}>
            {mine ? (
              <TimeZoneForm summary={mine.summary} timeZone={mine.timeZone} zones={timeZones()} />
            ) : (
              <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
                {t('readFailed')}
              </p>
            )}
          </div>
          <div className={`${row} sm:flex-row sm:items-center sm:justify-between`}>
            <div className="flex flex-col gap-0.5">
              <h3 className="m-0 text-[14px] font-bold max-md:text-[15px]">{t('sessionsLabel')}</h3>
              <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('sessionsHint')}</p>
            </div>
            <SignOutEverywhere />
          </div>
          <div className={row}>
            <h3 className="m-0 text-[14px] font-bold max-md:text-[15px]">{t('deleteTitle')}</h3>
            <div className="flex flex-col gap-1.5 text-[13.5px] leading-[1.55] text-text-2 max-md:text-[15px]">
              <p className="m-0">{t('deleteBody')}</p>
              <p className="m-0">{t('deleteKeeps')}</p>
              <p className="m-0">{t('deleteAlone')}</p>
            </div>
            <DeleteAccount />
          </div>
        </Card>
      </SettingsFrame>
    </ClientMessages>
  )
}

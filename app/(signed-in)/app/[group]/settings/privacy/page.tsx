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
import { RequestExport } from '@/components/settings/SettingsActions'
import { buttonVariants } from '@/components/ui/button'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadShell } from '@/lib/groups/load'
import { dateFormat } from '@/lib/i18n/dates'
import { loadMyProfile, loadMyShares } from '@/lib/profile/load'
import { ME_PATH, SIGN_IN_PATH } from '@/lib/routes'
import { DeleteProfile } from '../../../me/MeActions'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('settingsPrivacyTitle', { product: PRODUCT_NAME }) }
}

const row = 'flex flex-col gap-3 border-t border-line py-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between'
const HANDLED = [
  ['handledAnonymity', 'handledAnonymityBody'],
  ['handledNames', 'handledNamesBody'],
  ['handledProfile', 'handledProfileBody'],
  ['handledWhere', 'handledWhereBody'],
  ['handledPurpose', 'handledPurposeBody'],
] as const

/**
 * Privacy (handoff 6.18, design `settings` privacy tab): the person's consents, which in the MVP are the
 * Leader Profile's (sharing in Me, and "Delete my results", 0011), then "Download my data" (0023), then how
 * data is handled, in rules that hold today. The design's contribution view and profile modules are Phase 2,
 * and its retention row waits for the job that deletes on schedule (D-53).
 */
export default async function PrivacyPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const [t, tInvite] = await Promise.all([getTranslations('settings'), getTranslations('invite')])
  const [shell, profile, shares] = await Promise.all([loadShell(group, user.id), loadMyProfile(user.id), loadMyShares(user.id)])
  if (shell === null) return <PageProblem title={tInvite('readFailed')} />
  if (shell === 'none') return <PageProblem title={tInvite('notFoundTitle')} body={tInvite('notFoundBody')} />

  const date = (iso: string) => dateFormat({ locale: 'en', timeZone: 'UTC' }, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
  const shared = shares?.filter((s) => s.level !== 'nothing').length ?? 0

  return (
    <ClientMessages namespaces={['settings', 'me']}>
      <SettingsFrame group={{ id: group, name: shell.current.name }} active="privacy">
        <Card large className="flex flex-col">
          <SectionHeader title={t('consentsTitle')} meta={t('consentsMeta')} className="mb-4" />
          <div className={row}>
            <div className="flex flex-col gap-0.5">
              <h3 className="m-0 text-[14px] font-bold max-md:text-[15px]">{t('profileLabel')}</h3>
              <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">
                {profile === null || (profile !== 'none' && shares === null)
                  ? t('profileFailed')
                  : profile === 'none'
                    ? t('profileNone')
                    : t('profileTaken', { test: profile.test.name, date: date(profile.takenAt), count: shared })}
              </p>
            </div>
            {profile !== null && profile !== 'none' && (
              <div className="flex flex-wrap items-start gap-2">
                <Link href={ME_PATH as Route} className={buttonVariants({ variant: 'secondary' })}>
                  {t('profileSharing')}
                </Link>
                <DeleteProfile />
              </div>
            )}
          </div>
          <div className={row}>
            <div className="flex flex-col gap-0.5">
              <h3 className="m-0 text-[14px] font-bold max-md:text-[15px]">{t('exportLabel')}</h3>
              <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('exportHint')}</p>
            </div>
            <RequestExport email={user.email ?? ''} />
          </div>
        </Card>
        <Card large className="flex flex-col">
          <SectionHeader title={t('handledTitle')} meta={t('handledMeta')} className="mb-4" />
          <dl className="m-0 flex flex-col">
            {HANDLED.map(([term, body]) => (
              <div key={term} className="grid gap-1 border-t border-line py-3 first:border-t-0 first:pt-0 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4">
                <dt className="text-[14px] font-bold max-md:text-[15px]">{t(term)}</dt>
                <dd className="m-0 text-[14px] leading-[1.55] text-text-2 max-md:text-[15px]">{t(body)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </SettingsFrame>
    </ClientMessages>
  )
}

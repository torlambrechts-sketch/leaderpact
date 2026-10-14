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
import { GroupNameForm, ThresholdForm } from '@/components/settings/GroupSettings'
import { buttonVariants } from '@/components/ui/button'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadGroupSettings, loadShell } from '@/lib/groups/load'
import { SIGN_IN_PATH, assessPath, groupPath } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('groupSettingsTitle', { product: PRODUCT_NAME }) }
}

const row = 'flex flex-col gap-3 border-t border-line py-4 first:border-t-0 first:pt-0'
const label = 'm-0 text-[14px] font-bold max-md:text-[15px]'
const hint = 'm-0 text-[12.5px] text-text-2 max-md:text-[15px]'
const linkButton = buttonVariants({ variant: 'secondary', className: 'self-start sm:self-auto' })

/**
 * Group (handoff 6.18, design `settings` group tab): the group's name, its organisation, its members with the way
 * to the Group page where they are invited and removed, the anonymity threshold (4, raised up to 8, never lowered;
 * the organisation's, CLAUDE.md invariant 1), and where the rhythm and reminders are set. Only the team leader
 * changes anything; a member reads it. The design's survey language, coach access and "Delete group" are not
 * built: English is the only language, coach access is not in the handoff, and a group goes with its last member's
 * account (D-56). The organisation number is a billing detail, the leader's alone, so it is not shown here.
 */
export default async function GroupSettingsPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const [t, tInvite] = await Promise.all([getTranslations('settings'), getTranslations('invite')])
  const [shell, settings] = await Promise.all([loadShell(group, user.id), loadGroupSettings(group)])
  if (shell === null) return <PageProblem title={tInvite('readFailed')} />
  if (shell === 'none' || settings === 'none') return <PageProblem title={tInvite('notFoundTitle')} body={tInvite('notFoundBody')} />

  return (
    <ClientMessages namespaces={['settings']}>
      <SettingsFrame group={{ id: group, name: shell.current.name }} active="group">
        <Card large className="flex flex-col">
          <SectionHeader title={t('groupTitle')} meta={t('groupMeta', { group: shell.current.name })} className="mb-4" />
          {settings === null ? (
            <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
              {t('readFailed')}
            </p>
          ) : (
            <>
              <div className={row}>
                {settings.can_edit ? (
                  <GroupNameForm group={group} name={settings.name} />
                ) : (
                  <dl className="m-0 flex flex-col gap-1">
                    <dt className={label}>{t('groupNameLabel')}</dt>
                    <dd className="m-0 break-words text-[14.5px] max-md:text-[15px]">{settings.name}</dd>
                  </dl>
                )}
              </div>
              <dl className={`${row} m-0`}>
                <dt className={label}>{t('organisationLabel')}</dt>
                <dd className="m-0 break-words text-[14.5px] max-md:text-[15px]">{settings.organisation}</dd>
              </dl>
              <div className={`${row} sm:flex-row sm:items-center sm:justify-between`}>
                <div className="flex flex-col gap-0.5">
                  <h3 className={label}>{t('membersLabel')}</h3>
                  <p className={hint}>{t('membersHint', { members: settings.members, max: settings.members_max })}</p>
                </div>
                <Link href={groupPath(group) as Route} className={linkButton}>
                  {t('manageMembers')}
                </Link>
              </div>
              <div className={row}>
                <div className="flex flex-col gap-0.5">
                  <h3 className={label}>{t('thresholdLabel')}</h3>
                  <p className={hint}>{t('thresholdHint', { organisation: settings.organisation, threshold: settings.threshold })}</p>
                </div>
                {settings.can_edit ? (
                  <ThresholdForm
                    group={group}
                    threshold={settings.threshold}
                    max={settings.threshold_max}
                    members={settings.members}
                    organisation={settings.organisation}
                  />
                ) : (
                  <p className="m-0 text-[14.5px] font-semibold max-md:text-[15px]">{t('thresholdOption', { n: settings.threshold })}</p>
                )}
              </div>
              <div className={`${row} sm:flex-row sm:items-center sm:justify-between`}>
                <div className="flex flex-col gap-0.5">
                  <h3 className={label}>{t('rhythmLabel')}</h3>
                  <p className={hint}>{t('rhythmHint')}</p>
                </div>
                <Link href={assessPath(group) as Route} className={linkButton}>
                  {t('rhythmLink')}
                </Link>
              </div>
              {!settings.can_edit && <p className={`${row} ${hint}`}>{t('groupReadOnly')}</p>}
            </>
          )}
        </Card>
      </SettingsFrame>
    </ClientMessages>
  )
}

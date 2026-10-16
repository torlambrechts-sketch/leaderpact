import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadBillingRules } from '@/lib/billing/load'
import { ensurePerson, loadMyGroups } from '@/lib/groups/load'
import { notifyOwner } from '@/lib/platform/owner-notice'
import { loadScan } from '@/lib/scan/load'
import { SIGN_IN_PATH } from '@/lib/routes'
import { NewGroup } from './NewGroup'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('newGroupTitle', { product: PRODUCT_NAME }) }
}

/**
 * Where every sign-in leads (handoff 6.3): the email link, a password, Google or Microsoft (D-57). The person row
 * is made here from the name given at sign-up (0028), and the first time it is, the owner gets a copy after the
 * response (D-59). The device decides what happens next, since
 * only it holds the save card's group and the leader's answers (lib/scan/device.ts, D-15): with a save,
 * the group is made and the answers go to its scan; without one, the person's group opens, or the form
 * to make one.
 */
export default async function NewGroupPage() {
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  // the person row from the name given at sign-up, before anything reads it (0028)
  const isNew = await ensurePerson()
  const [groups, scan, rules] = await Promise.all([loadMyGroups(user.id), loadScan(), loadBillingRules()])
  const meta = user.user_metadata ?? {}
  const company = typeof meta.company === 'string' ? meta.company.slice(0, 200) : ''
  if (isNew) {
    const name = typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : ''
    const method = typeof user.app_metadata?.provider === 'string' ? user.app_metadata.provider : ''
    after(() => notifyOwner('sign_up', { name, email: user.email ?? '', company, method }).then(() => undefined))
  }
  return (
    <div className="mx-auto mt-6 max-w-questionnaire px-4 md:mt-10">
      <ClientMessages namespaces={['newGroup', 'save']}>
        <NewGroup firstGroup={groups?.[0]?.id ?? null} scan={scan} company={company} trialDays={rules?.trialDays ?? null} />
      </ClientMessages>
    </div>
  )
}

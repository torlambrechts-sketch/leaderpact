import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { ensurePerson, loadMyGroups } from '@/lib/groups/load'
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
 * is made here from the name given at sign-up (0028). The device decides what happens next, since
 * only it holds the save card's group and the leader's answers (lib/scan/device.ts, D-15): with a save,
 * the group is made and the answers go to its scan; without one, the person's group opens, or the form
 * to make one.
 */
export default async function NewGroupPage() {
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  // the person row from the name given at sign-up, before anything reads it (0028)
  await ensurePerson()
  const [groups, scan] = await Promise.all([loadMyGroups(user.id), loadScan()])
  const company = typeof user.user_metadata?.company === 'string' ? user.user_metadata.company.slice(0, 200) : ''
  return (
    <div className="mx-auto mt-6 max-w-questionnaire px-4 md:mt-10">
      <ClientMessages namespaces={['newGroup', 'save']}>
        <NewGroup firstGroup={groups?.[0]?.id ?? null} scan={scan} company={company} />
      </ClientMessages>
    </div>
  )
}

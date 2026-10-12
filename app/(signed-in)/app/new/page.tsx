import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadMyGroups } from '@/lib/groups/load'
import { loadScan } from '@/lib/scan/load'
import { SIGN_IN_PATH } from '@/lib/routes'
import { NewGroup } from './NewGroup'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('newGroupTitle', { product: PRODUCT_NAME }) }
}

/**
 * Where the email link leads after sign-in (handoff 6.3). The device decides what happens next, since
 * only it holds the save card's group and the leader's answers (lib/scan/device.ts, D-15): with a save,
 * the group is made and the answers go to its scan; without one, the person's group opens, or the form
 * to make one.
 */
export default async function NewGroupPage() {
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const [groups, scan] = await Promise.all([loadMyGroups(user.id), loadScan()])
  return (
    <div className="mx-auto mt-6 max-w-questionnaire px-4 md:mt-10">
      <ClientMessages namespaces={['newGroup', 'save']}>
        <NewGroup firstGroup={groups?.[0]?.id ?? null} scan={scan} />
      </ClientMessages>
    </div>
  )
}

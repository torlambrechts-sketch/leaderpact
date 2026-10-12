import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { currentUser } from '@/lib/auth/session'
import { loadMyGroups } from '@/lib/groups/load'
import { NEW_GROUP_PATH, SIGN_IN_PATH, invitePath } from '@/lib/routes'

export const dynamic = 'force-dynamic'

/**
 * The signed-in start: the person's first group, or making one. Home is milestone 6; until then a group
 * opens on its scan status and invite link (design `invite`).
 */
export default async function AppStart() {
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const groups = await loadMyGroups(user.id)
  if (groups === null) {
    const t = await getTranslations('newGroup')
    return (
      <div className="mx-auto mt-6 max-w-questionnaire px-4 md:mt-10">
        <p role="alert" className="rounded-card-lg border border-white bg-surface p-6 text-[15px] text-text-2">
          {t('readFailed')}
        </p>
      </div>
    )
  }
  const first = groups[0]
  redirect((first ? invitePath(first.id) : NEW_GROUP_PATH) as Route)
}

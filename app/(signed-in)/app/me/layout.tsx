import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { AppShell } from '@/components/app/AppShell'
import { SimpleBar } from '@/components/lp/SimpleBar'
import { currentUser } from '@/lib/auth/session'
import { loadMyGroups, loadShell } from '@/lib/groups/load'
import { SIGN_IN_PATH } from '@/lib/routes'

export const dynamic = 'force-dynamic'

/**
 * Me (handoff section 5): not per group, so the shell's links lead to the person's first group, as the
 * signed-in start does (/app). Someone with a profile and no group yet gets the simple bar.
 */
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const groups = await loadMyGroups(user.id)
  const shell = groups?.[0] ? await loadShell(groups[0].id, user.id) : null
  if (!shell || shell === 'none') {
    return (
      <>
        <SimpleBar />
        <main id="main" className="pb-12">
          {children}
        </main>
      </>
    )
  }
  return (
    <AppShell shell={shell} active="me">
      {children}
    </AppShell>
  )
}

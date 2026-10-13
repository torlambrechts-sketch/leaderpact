import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { AppShell } from '@/components/app/AppShell'
import { SimpleBar } from '@/components/lp/SimpleBar'
import { currentUser } from '@/lib/auth/session'
import { loadShell } from '@/lib/groups/load'
import { SIGN_IN_PATH } from '@/lib/routes'

export const dynamic = 'force-dynamic'

/**
 * The app shell for a group (components/app/AppShell.tsx). A person who is not a current member of the
 * group gets the simple bar, and the page says the group is not theirs.
 */
export default async function GroupLayout({ children, params }: { children: React.ReactNode; params: Promise<{ group: string }> }) {
  const { group } = await params
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const shell = await loadShell(group, user.id)
  if (shell === null || shell === 'none') {
    return (
      <>
        <SimpleBar />
        <main id="main">{children}</main>
      </>
    )
  }
  return <AppShell shell={shell}>{children}</AppShell>
}

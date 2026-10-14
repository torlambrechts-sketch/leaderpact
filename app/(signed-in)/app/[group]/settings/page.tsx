import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { accountPath } from '@/lib/routes'

/** Settings opens on the person's Account tab (handoff 6.18) */
export default async function SettingsPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  redirect(accountPath(group) as Route)
}

import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { planBillingPath } from '@/lib/routes'

/** Settings opens on its one tab so far, Plan and billing (handoff 6.18; the other four follow, D-33) */
export default async function SettingsPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  redirect(planBillingPath(group) as Route)
}

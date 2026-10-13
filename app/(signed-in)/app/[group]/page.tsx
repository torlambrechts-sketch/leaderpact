import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { homePath } from '@/lib/routes'

/** /app/<group> is the group's Home (handoff section 5) */
export default async function GroupIndex({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  redirect(homePath(encodeURIComponent(group)) as Route)
}

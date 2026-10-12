import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { confirmSchema } from '@/lib/auth/schema'
import { CONFIRM_PATH, LANDING_PATH } from '@/lib/routes'

/**
 * The root address leads to the landing page, whose path says what it is (handoff section 5). A
 * temporary redirect: the name, and with it the site's addresses, is not cleared (handoff section 0).
 *
 * One exception: an email link whose return address Auth did not accept falls back to the site address
 * (supabase/templates), so a sign-in token arriving here is passed on to the confirmation page.
 */
export default async function Root({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const link = confirmSchema.safeParse({ token_hash: params.token_hash, type: params.type })
  if (link.success) {
    redirect(`${CONFIRM_PATH}?${new URLSearchParams({ token_hash: link.data.token_hash, type: link.data.type })}` as Route)
  }
  redirect(LANDING_PATH as Route)
}

import { redirect } from 'next/navigation'
import { LANDING_PATH } from '@/lib/routes'

/**
 * The root address leads to the landing page, whose path says what it is (handoff section 5). A
 * temporary redirect: the name, and with it the site's addresses, is not cleared (handoff section 0).
 */
export default function Root() {
  redirect(LANDING_PATH)
}

import 'server-only'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * The signed-in person, revalidated with Auth (getUser, never getSession: a cookie alone is no basis for
 * a decision), or null. The middleware has already refused a request without a session to a page that
 * needs one; this is the page's own check, and gives it the id.
 */
export async function currentUser(): Promise<User | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return null
    return data.user
  } catch {
    return null
  }
}

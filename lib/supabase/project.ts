/**
 * LeaderPact's one hosted Supabase project (CLAUDE.md, The hosted project).
 *
 * A cloud session's environment can hold another product's Supabase URL: the one this repository was
 * built in held Orgpuls's production project. An app that trusted it would read and write Orgpuls's
 * database with Orgpuls's key. So the app accepts a hosted Supabase URL only for this project, and a local
 * stack (localhost or 127.0.0.1) for development and CI.
 */
export const LEADERPACT_PROJECT_REF = 'tgxjbshdjwoemsmrtkzw'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', 'host.docker.internal'])

/** null when the URL is LeaderPact's project or a local stack; otherwise why it is refused */
export function foreignProject(url: URL): string | null {
  if (LOCAL_HOSTS.has(url.hostname)) return null
  const ref = url.hostname.match(/^([a-z0-9]{20})\.supabase\.(co|in)$/)?.[1]
  if (ref === LEADERPACT_PROJECT_REF) return null
  return ref
    ? `NEXT_PUBLIC_SUPABASE_URL names the Supabase project ${ref}, not LeaderPact's (${LEADERPACT_PROJECT_REF}). Another product's database is never used.`
    : `NEXT_PUBLIC_SUPABASE_URL is neither LeaderPact's project (${LEADERPACT_PROJECT_REF}.supabase.co) nor a local stack.`
}

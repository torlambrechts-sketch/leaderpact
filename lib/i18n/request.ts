import { getRequestConfig } from 'next-intl/server'
import messages from '@/messages/en.json'

/**
 * English is the only locale (handoff section 3), and there is no locale in the path.
 *
 * Adapted from Orgpuls lib/i18n/request.ts @ 6f5d441, which resolves one of several locales from a
 * caller, a host, a cookie and a profile, and layers registry and market overlays on top. None of
 * that applies to one catalogue, so this is the whole of it.
 *
 * A missing key renders as `namespace.key`, which is visible in review rather than blank. The time
 * zone is UTC until a person's own zone exists (Settings, Account; handoff 6.18).
 */
export const LOCALE = 'en'

export default getRequestConfig(async () => ({
  locale: LOCALE,
  messages,
  timeZone: 'UTC',
  getMessageFallback: ({ namespace, key }) => (namespace ? `${namespace}.${key}` : key),
  onError: (error) => {
    // the code only: a message's arguments can carry what a person wrote
    console.error(`[i18n] ${error.code}`)
  },
}))

// Origin: Orgpuls lib/i18n/client.ts @ 6f5d441 (adapted: LeaderPact's namespaces).
import type { AbstractIntlMessages } from 'next-intl'

/**
 * The messages a part of the site's client components read, and only those.
 *
 * NextIntlClientProvider serialises the messages it is given into every page's HTML, so a page is
 * given the namespaces its client components use rather than the whole catalogue.
 */
export const PUBLIC_CLIENT_NAMESPACES = ['common'] as const

export function pickMessages(messages: AbstractIntlMessages, namespaces: readonly string[]): AbstractIntlMessages {
  const picked: AbstractIntlMessages = {}
  for (const n of namespaces) {
    const m = messages[n]
    if (m !== undefined) picked[n] = m
  }
  return picked
}

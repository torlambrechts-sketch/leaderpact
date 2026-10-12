import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { pickMessages } from '@/lib/i18n/client'

/**
 * Hands a page's client components the message namespaces they read, and only those (lib/i18n/client.ts):
 * the provider serialises its messages into the page's HTML. A nested provider replaces the outer one's
 * messages, so `common` is always included.
 */
export async function ClientMessages({ namespaces, children }: { namespaces: readonly string[]; children: React.ReactNode }) {
  const messages = await getMessages()
  return <NextIntlClientProvider messages={pickMessages(messages, ['common', ...namespaces])}>{children}</NextIntlClientProvider>
}

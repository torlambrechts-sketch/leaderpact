import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { SCAN_CLIENT_NAMESPACES, pickMessages } from '@/lib/i18n/client'

/** The scan's client components read the `scan` and `result` messages; only those reach the page */
export default async function ScanLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages()
  return <NextIntlClientProvider messages={pickMessages(messages, SCAN_CLIENT_NAMESPACES)}>{children}</NextIntlClientProvider>
}

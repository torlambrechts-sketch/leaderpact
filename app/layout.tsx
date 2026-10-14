import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { PRODUCT_NAME } from '@/lib/brand'
import { LOCALE } from '@/lib/i18n/request'
import { PUBLIC_CLIENT_NAMESPACES, pickMessages } from '@/lib/i18n/client'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return {
    title: t('title', { product: PRODUCT_NAME }),
    description: t('description', { product: PRODUCT_NAME }),
    // the public site is indexed since the owner switched it on (D-40); the questionnaires, the result, sign-in,
    // the invite link and the app say noindex themselves, and every host but www.leaderpact.com says it in a
    // header (next.config.ts)
    robots: { index: true, follow: true },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages()
  const t = await getTranslations('common')
  return (
    <html lang={LOCALE === 'en' ? 'en-GB' : LOCALE}>
      <body>
        <a href="#main" className="skip-link">
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider messages={pickMessages(messages, PUBLIC_CLIENT_NAMESPACES)}>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}

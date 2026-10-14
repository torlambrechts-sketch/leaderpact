import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { PRODUCT_NAME } from '@/lib/brand'
import { SCAN_PATH, SIGN_IN_PATH } from '@/lib/routes'
import { ARTICLES_PATH } from '@/lib/site/articles'
import { PLATFORM_PATH } from '@/lib/site/features'
import { NOINDEX } from '@/lib/site/meta'
import { TEMPLATES_PATH } from '@/lib/site/templates'
import { PublicChrome } from '@/components/site/PublicChrome'
import { ArticleArt } from '@/components/site/art/ArticleArt'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notFound')
  return { title: t('metaTitle', { product: PRODUCT_NAME }), robots: NOINDEX }
}

/**
 * Every address the app has no page for, and every page that says it has nothing (D-50): a 404 in the site's
 * chrome, with the way to the scan and to the pages a visitor most likely came for. The domain held an earlier
 * site, and its old addresses now end here, where they used to end at sign-in.
 */
export default async function NotFound() {
  const t = await getTranslations('notFound')
  const nav = await getTranslations('publicNav')
  const links = [
    { href: PLATFORM_PATH, label: nav('howItWorks'), text: t('platformText', { product: PRODUCT_NAME }) },
    { href: ARTICLES_PATH, label: nav('articles'), text: t('articlesText') },
    { href: TEMPLATES_PATH, label: nav('templates'), text: t('templatesText') },
    { href: SIGN_IN_PATH, label: nav('signIn'), text: t('signInText') },
  ]
  return (
    <PublicChrome beacon={false}>
      <div className="mx-auto flex max-w-site flex-col gap-12 px-4 pb-6 pt-8 md:px-gutter md:pt-12">
        <header className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_400px] xl:gap-16">
          <div className="flex max-w-[760px] flex-col gap-4">
            <p className="m-0 self-start rounded-pill bg-accent px-3 py-[5px] text-[12.5px] font-semibold text-accent-ink">{t('kicker')}</p>
            <h1 className="m-0 font-display text-[44px] font-medium leading-[1.08] tracking-[-0.03em] max-md:text-[32px]">{t('title')}</h1>
            <p className="m-0 text-[19px] leading-[1.6] text-text-3 max-md:text-[17px]" style={{ textWrap: 'pretty' }}>
              {t('lead')}
            </p>
            <Link
              href={SCAN_PATH as Route}
              className="mt-2 inline-flex items-center gap-2 self-start rounded-btn bg-ink px-[22px] py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,.35)] hover:text-white"
            >
              {t('start')}
              <ArrowRight aria-hidden size={16} />
            </Link>
          </div>
          <ArticleArt kind="compass" className="hidden h-auto w-full lg:block" />
        </header>
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href as Route}
                className="group flex h-full flex-col gap-2 rounded-card border border-bar bg-surface px-6 py-5 text-ink no-underline transition-shadow hover:text-ink hover:shadow-[0_18px_40px_-28px_rgba(17,17,17,0.45)]"
              >
                <span className="inline-flex items-center gap-1.5 font-display text-[19px] font-medium leading-[1.25] group-hover:underline">
                  {l.label}
                  <ArrowRight aria-hidden size={16} />
                </span>
                <span className="text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">{l.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </PublicChrome>
  )
}

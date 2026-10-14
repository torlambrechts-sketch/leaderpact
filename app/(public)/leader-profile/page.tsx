import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { ArrowRight, BookOpen, Lock } from 'lucide-react'
import { PRODUCT_NAME } from '@/lib/brand'
import { pageCard } from '@/lib/site/cards'
import { pageMeta } from '@/lib/site/meta'
import { loadProfileTest } from '@/lib/profile/load'
import { PROFILE_PATH, profileTestPath } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return pageMeta({ title: t('profileTitle', { product: PRODUCT_NAME }), description: t('profileDescription'), path: PROFILE_PATH, image: pageCard('leader-profile') })
}

/**
 * The Leader Profile's public page (handoff section 5 and 6.17; "use the landing layout"): the two tests,
 * both free and both taken with no account, what the result is and is not, and that it is private until
 * shared. The tests' names come from their rows; the sources are credited, as public-domain items.
 */
export default async function LeaderProfilePage() {
  const [t, quick, full] = await Promise.all([getTranslations('profile'), loadProfileTest('quick'), loadProfileTest('full')])
  const tests = [
    { key: 'quick' as const, title: t('quickTitle'), badge: t('firstLook'), facts: t('quickFacts'), start: t('startQuick'), available: quick !== null },
    { key: 'full' as const, title: t('fullTitle'), badge: null, facts: t('fullFacts'), start: t('startFull'), available: full !== null },
  ]
  return (
    <div className="mx-auto mt-4 flex max-w-site flex-col gap-6 px-4 md:mt-6 md:px-gutter">
      <section className="flex flex-col gap-6 rounded-hero border border-bar bg-hero px-5 py-8 md:px-16 md:py-14">
        <p className="m-0 inline-flex items-center gap-2 self-start rounded-pill border border-bar bg-white-veil px-3 py-[5px] text-[13px] font-semibold text-landing-pill-ink">
          {t('eyebrow')}
        </p>
        <h1 className="m-0 font-display text-landing-headline max-md:text-[40px] max-md:leading-[1.06]">{t('title')}</h1>
        <p className="m-0 max-w-[640px] text-[18px] leading-[1.55] text-text-3 max-md:text-[17px]" style={{ textWrap: 'pretty' }}>
          {t('lead')}
        </p>
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
          {tests.map((test) => (
            <li key={test.key} className="flex flex-col gap-3 rounded-card border border-bar bg-surface px-6 py-[22px]">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="m-0 text-[18px] font-bold">{test.title}</h2>
                {test.badge && <span className="rounded-pill bg-accent px-2.5 py-1 text-[12px] font-semibold text-accent-ink">{test.badge}</span>}
              </div>
              <p className="m-0 text-[14px] text-text-2 max-md:text-[15px]">{test.facts}</p>
              {test.available ? (
                <Link
                  href={profileTestPath(test.key) as Route}
                  className="mt-1 inline-flex min-h-[44px] items-center gap-2 self-start rounded-btn bg-ink px-[18px] py-3 text-[14px] font-semibold text-white hover:text-white"
                >
                  {test.start}
                  <ArrowRight aria-hidden size={16} />
                </Link>
              ) : (
                <p role="status" className="m-0 text-[14px] font-semibold max-md:text-[15px]">
                  {t('unavailableTitle')}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-card-lg border border-white bg-surface px-6 py-6 md:px-8">
          <h2 className="m-0 text-[18px] font-bold">{t('howTitle')}</h2>
          <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">
            <li>{t('how1')}</li>
            <li>{t('how2')}</li>
            <li>{t('how3')}</li>
            <li>{t('how4')}</li>
          </ul>
        </div>
        <div className="flex flex-col gap-3 rounded-card-lg border border-white bg-surface px-6 py-6 md:px-8">
          <h2 className="m-0 flex items-center gap-2 text-[18px] font-bold">
            <Lock aria-hidden size={18} />
            {t('privateTitle')}
          </h2>
          <p className="m-0 text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">{t('privateBody')}</p>
          <p className="m-0 text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">{t('purpose')}</p>
        </div>
      </section>

      <div className="flex flex-col gap-1.5 text-[13px] text-text-2 max-md:text-[15px]">
        <p className="m-0 flex items-center gap-1.5 font-semibold text-ink">
          <BookOpen aria-hidden size={15} />
          {t('label')}
        </p>
        {quick && full && <p className="m-0">{t('source', { quick: quick.name, full: full.name })}</p>}
      </div>
    </div>
  )
}

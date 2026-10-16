import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { ArrowRight } from 'lucide-react'
import { TraitBars, type TraitLabels } from '@/components/profile/TraitBars'
import { buttonVariants } from '@/components/ui/button'
import { PRODUCT_NAME } from '@/lib/brand'
import { dateFormat } from '@/lib/i18n/dates'
import { loadLinkedProfile } from '@/lib/profile/link'
import { PROFILE_PATH } from '@/lib/routes'
import { NOINDEX } from '@/lib/site/meta'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('sharedProfileTitle', { product: PRODUCT_NAME }), robots: NOINDEX }
}

/**
 * A Leader Profile opened by its private link (D-66): what its owner chose to show, the domains or the domains
 * and facets, as bands only, with the labels every result carries. Read as a visitor; never indexed, never counted
 * (lib/site/beacon.ts), and sent with no referrer, since the path is the capability. A link that is unknown, ended
 * or replaced reads the same, so it says nothing of whether a profile exists.
 */
export default async function LinkedProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [t, tp, profile] = await Promise.all([getTranslations('profileShared'), getTranslations('profile'), loadLinkedProfile(token)])
  const take = (
    <Link href={PROFILE_PATH as Route} className={buttonVariants({ variant: 'secondary', className: 'gap-2 self-start' })}>
      {t('takeYours')}
      <ArrowRight aria-hidden size={15} />
    </Link>
  )

  if (profile === null || profile === 'not_found') {
    return (
      <div className="mx-auto mt-6 max-w-[620px] px-4 pb-10 md:mt-12">
        <section className="flex flex-col gap-3 rounded-card-lg border border-white bg-surface p-6 md:p-9">
          <h1 className="m-0 font-display text-sub-headline">{profile === null ? t('readFailed') : t('notFoundTitle')}</h1>
          {profile === 'not_found' && <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('notFoundBody')}</p>}
          {take}
        </section>
      </div>
    )
  }

  const labels: TraitLabels = {
    bands: { lower: tp('result.band_lower'), middle: tp('result.band_middle'), higher: tp('result.band_higher') },
    words: (n, b) => tp('result.traitWords', { name: n, band: b }),
    bandsLabel: tp('result.bandsLabel'),
    facetsOf: (domain) => tp('result.facetsOf', { domain }),
  }
  const day = dateFormat({ locale: 'en', timeZone: 'UTC' }, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${profile.takenOn}T12:00:00Z`))
  const test = tp(profile.test === 'quick' ? 'result.testQuick' : 'result.testFull', { name: profile.testName, items: profile.items })

  return (
    <div className="mx-auto mt-6 flex max-w-[860px] flex-col gap-5 px-4 pb-10 md:mt-10">
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.06em] text-text-2 max-md:text-[15px]">{t('eyebrow')}</p>
        <h1 className="m-0 font-display text-page-title max-md:text-[30px]">{profile.name}</h1>
        <p className="m-0 text-[14px] text-text-2 max-md:text-[15px]">{t('meta', { test, date: day })}</p>
      </div>
      <section aria-labelledby="domains" className="flex flex-col gap-4 rounded-card-lg border border-white bg-surface px-6 py-6 md:px-8">
        <h2 id="domains" className="m-0 text-[18px] font-bold">
          {tp('result.domains')}
        </h2>
        <TraitBars domains={profile.domains} facets={profile.facets} labels={labels} />
        <div className="flex flex-col gap-1 border-t border-rule-softer pt-3 text-[12.5px] leading-[1.5] text-muted max-md:text-[15px]">
          <p className="m-0">{t('scaleNote')}</p>
          <p className="m-0">{t('notGrade')}</p>
          <p className="m-0">{tp('label')}</p>
        </div>
      </section>
      <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{tp('purpose')}</p>
      {take}
    </div>
  )
}

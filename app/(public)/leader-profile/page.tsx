import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { ArrowRight, BookOpen, Lock } from 'lucide-react'
import { PRODUCT_NAME } from '@/lib/brand'
import { pageCard } from '@/lib/site/cards'
import { featurePath } from '@/lib/site/features'
import { pageMeta } from '@/lib/site/meta'
import { loadBandSet, loadProfileTest } from '@/lib/profile/load'
import { testSource } from '@/lib/profile/sources'
import type { ProfileTest } from '@/lib/profile/score'
import { PROFILE_PATH, profileTestPath } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return pageMeta({ title: t('profileTitle', { product: PRODUCT_NAME }), description: t('profileDescription'), path: PROFILE_PATH, image: pageCard('leader-profile') })
}

/** The statements per trait of a kind, when every trait of that kind has the same number; null otherwise */
function perTrait(test: ProfileTest, kind: 'domain' | 'facet'): number | null {
  const keys = test.traits.filter((tr) => tr.kind === kind).map((tr) => tr.key)
  const counts = new Set(keys.map((key) => test.items.filter((item) => item.trait === key).length))
  const [only] = [...counts]
  return keys.length && counts.size === 1 && only ? only : null
}

const limit = (value: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value)

/**
 * The Leader Profile's public page (handoff section 5 and 6.17; "use the landing layout"): the two tests,
 * both free and both taken with no account, what the result is and is not, and that it is private until
 * shared. The tests' names come from their rows; the sources are credited, as public-domain items.
 *
 * What it measures and what the questions look like (D-62) are read from the published rows: the domains and
 * their facets, the first statement of the quick test as an example, how many statements each trait has and
 * how many count the other way. The band limits are the band set in force (D-31). Nothing here is a number the
 * rows do not hold; a part whose rows cannot be read is left out.
 */
export default async function LeaderProfilePage() {
  const [t, tf, quick, full, bands] = await Promise.all([
    getTranslations('profile'),
    getTranslations('profile.flow'),
    loadProfileTest('quick'),
    loadProfileTest('full'),
    loadBandSet(),
  ])
  const tests = [
    { key: 'quick' as const, title: t('quickTitle'), badge: t('firstLook'), facts: t('quickFacts'), start: t('startQuick'), available: quick !== null },
    { key: 'full' as const, title: t('fullTitle'), badge: null, facts: t('fullFacts'), start: t('startFull'), available: full !== null },
  ]
  const byOrdinal = <T extends { ordinal: number }>(list: T[]) => [...list].sort((a, b) => a.ordinal - b.ordinal)
  const domains = full
    ? byOrdinal(full.traits.filter((tr) => tr.kind === 'domain')).map((d) => ({
        ...d,
        facets: byOrdinal(full.traits.filter((tr) => tr.kind === 'facet' && tr.domain === d.key)),
      }))
    : []
  const facetsPerDomain = new Set(domains.map((d) => d.facets.length))
  const [perDomain] = [...facetsPerDomain]
  const example = quick ? byOrdinal(quick.items)[0] : undefined
  const quickPer = quick ? perTrait(quick, 'domain') : null
  const fullPer = full ? perTrait(full, 'facet') : null
  const reversed = full ? full.items.filter((item) => item.keyed === -1).length : 0
  const sources = [quick, full].flatMap((test) => {
    const found = test ? testSource(test.key, test.version) : null
    return found && test ? [{ key: test.key, ...found }] : []
  })
  const body = 'm-0 text-[16px] leading-[1.6] text-text-2 max-md:text-[15px]'
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

      {domains.length && perDomain && facetsPerDomain.size === 1 ? (
        <section aria-labelledby="measures" className="flex flex-col gap-4 rounded-card-lg border border-white bg-surface px-6 py-7 md:px-10 md:py-9">
          <h2 id="measures" className="m-0 font-display text-[28px] font-medium tracking-[-0.02em] max-md:text-[24px]">
            {t('measuresTitle')}
          </h2>
          <p className={`${body} max-w-[720px]`}>{t('measuresLead', { perDomain })}</p>
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
            {domains.map((d) => (
              <li key={d.key} className="flex flex-col gap-2 rounded-card border border-bar bg-white px-5 py-4">
                <h3 className="m-0 text-[17px] font-bold">{d.name}</h3>
                <ul aria-label={t('facetsOf', { domain: d.name })} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                  {d.facets.map((f) => (
                    <li key={f.key} className="rounded-pill bg-surface px-2.5 py-1 text-[13px] text-text-body max-md:text-[15px]">
                      {f.name}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {quick ? (
            <p className={body}>
              {t('quickNames', { quick: quick.name, names: byOrdinal(quick.traits.filter((tr) => tr.kind === 'domain')).map((d) => d.name).join(', ') })}
            </p>
          ) : null}
        </section>
      ) : null}

      {example ? (
        <section aria-labelledby="questions" className="grid gap-6 rounded-card-lg border border-white bg-surface px-6 py-7 md:px-10 md:py-9 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 id="questions" className="m-0 font-display text-[28px] font-medium tracking-[-0.02em] max-md:text-[24px]">
              {t('questionsTitle')}
            </h2>
            <p className={body}>{t('questionsLead')}</p>
            <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-[1.55] text-text-2">
              {quickPer && fullPer ? <li>{t('questionsPer', { quickPer, fullPer })}</li> : null}
              {full && reversed ? <li>{t('questionsReversed', { reversed, total: full.items.length })}</li> : null}
              <li>{t('questionsWording')}</li>
              <li>{t('questionsDevice')}</li>
            </ul>
          </div>
          <figure className="m-0 flex flex-col gap-3 self-start rounded-card border border-bar bg-white px-5 py-5">
            <figcaption className="text-[13px] font-semibold text-text-2 max-md:text-[15px]">{t('exampleLabel', { test: quick?.name ?? '' })}</figcaption>
            <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{tf('ask')}</p>
            <blockquote className="m-0 font-display text-[22px] font-medium leading-[1.3]">{example.text}</blockquote>
            <ol aria-label={t('scaleLabel')} className="m-0 flex list-none flex-col gap-1.5 p-0">
              {(['1', '2', '3', '4', '5'] as const).map((value) => (
                <li key={value} className="rounded-btn border border-bar px-3 py-2 text-[14px] text-text-body max-md:text-[15px]">
                  {tf(`options.${value}`)}
                </li>
              ))}
            </ol>
          </figure>
        </section>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-card-lg border border-white bg-surface px-6 py-6 md:px-8">
          <h2 className="m-0 text-[18px] font-bold">{t('resultTitle')}</h2>
          <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">
            {bands ? <li>{t('resultBands', { lower: limit(bands.lowerBelow), higher: limit(bands.higherAbove) })}</li> : null}
            <li>{t('resultNorm')}</li>
            <li>{t('resultYou')}</li>
            <li>{t('resultNever')}</li>
          </ul>
        </div>
        <div className="flex flex-col gap-3 rounded-card-lg border border-white bg-surface px-6 py-6 md:px-8">
          <h2 className="m-0 flex items-center gap-2 text-[18px] font-bold">
            <Lock aria-hidden size={18} />
            {t('privateTitle')}
          </h2>
          <p className="m-0 text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">{t('privateBody')}</p>
          <p className="m-0 text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">{t('purpose')}</p>
          <Link
            href={featurePath('leader-profile') as Route}
            className="mt-1 inline-flex min-h-[44px] items-center gap-2 self-start text-[14.5px] font-semibold text-ink max-md:text-[15px]"
          >
            {t('seeInApp')}
            <ArrowRight aria-hidden size={16} />
          </Link>
        </div>
      </section>

      <div className="flex flex-col gap-1.5 text-[13px] text-text-2 max-md:text-[15px]">
        <p className="m-0 flex items-center gap-1.5 font-semibold text-ink">
          <BookOpen aria-hidden size={15} />
          {t('label')}
        </p>
        {quick && full && <p className="m-0">{t('source', { quick: quick.name, full: full.name })}</p>}
        {sources.length ? (
          <>
            <h2 className="m-0 mt-2 text-[13px] font-semibold text-ink max-md:text-[15px]">{t('sourcesTitle')}</h2>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {sources.map((source) => (
                <li key={source.key}>
                  <a href={source.url} className="break-words text-text-2 underline decoration-1 underline-offset-2">
                    {source.citation}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { EvidenceChip } from '@/components/lp/EvidenceChip'
import { ProductPage } from '@/components/site/ProductPage'
import { pageCard } from '@/lib/site/cards'
import { pageMeta } from '@/lib/site/meta'
import { loadPage, PRODUCT_PAGES } from '@/lib/site/pages'
import bank from '@/data/instrument/bank.v1.json'

const PAGE = PRODUCT_PAGES.research
const LAYERS = ['conditions', 'processes', 'states', 'outcomes'] as const

export function generateMetadata(): Metadata {
  const c = loadPage('research')
  return pageMeta({ title: c.title, description: c.description, path: PAGE.path, image: pageCard('research') })
}

/**
 * The model (D-37): the four layers and every scale with how it is read and its evidence rating, read from
 * the published bank (data/instrument/bank.v1.json), so the page and the product cannot disagree. The
 * items themselves are not shown.
 */
export default async function ResearchPage() {
  const t = await getTranslations('site.research')
  const tEvidence = await getTranslations('evidence')
  const factors = [...bank.factors].sort((a, b) => a.ordinal - b.ordinal)
  const model = (
    <section aria-labelledby="the-model" className="mt-14 flex flex-col gap-6">
      <h2 id="the-model" className="m-0 font-display text-section-headline max-md:text-[28px]">
        {t('modelTitle')}
      </h2>
      {LAYERS.map((layer) => {
        const rows = factors.filter((f) => f.layer === layer)
        return (
          <div key={layer} tabIndex={0} role="region" aria-label={t(`layers.${layer}.title`, { count: rows.length })} className="overflow-x-auto rounded-card border border-bar bg-surface">
            <table className="w-full border-collapse text-left text-[15px] leading-[1.5]">
              <caption className="px-5 pb-1 pt-4 text-left">
                <span className="block text-[17px] font-bold text-ink">{t(`layers.${layer}.title`, { count: rows.length })}</span>
                <span className="block text-[14px] text-text-2">{t(`layers.${layer}.text`)}</span>
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="border-b border-bar px-5 py-2.5 font-semibold text-text-2">
                    {t('scale')}
                  </th>
                  <th scope="col" className="border-b border-bar px-5 py-2.5 font-semibold text-text-2">
                    {t('reading')}
                  </th>
                  <th scope="col" className="border-b border-bar px-5 py-2.5 font-semibold text-text-2">
                    {t('evidence')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.key} className="border-b border-rule-softer last:border-b-0">
                    <th scope="row" className="px-5 py-2.5 font-semibold text-ink">
                      {f.name}
                    </th>
                    <td className="px-5 py-2.5 text-text-body">{t(`readings.${f.readingType}`)}</td>
                    <td className="px-5 py-2.5">
                      <EvidenceChip
                        rating={f.evidence === 'strong' ? 'strong' : f.evidence === 'moderate' ? 'moderate' : 'other'}
                        label={f.evidence ? tEvidence(f.evidence) : tEvidence('self_rated')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </section>
  )
  return <ProductPage path={PAGE.path} content={loadPage('research')} related={PAGE.related} extra={model} />
}

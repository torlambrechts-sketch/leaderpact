import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, FileText } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { JsonLd } from '@/components/site/JsonLd'
import { pageCard } from '@/lib/site/cards'
import { absolute } from '@/lib/site/config'
import { pageMeta } from '@/lib/site/meta'
import { breadcrumbs, graph, organization, webPage } from '@/lib/site/schema'
import { TEMPLATES_PATH, templatePath } from '@/lib/site/templates'
import { allTemplates } from '@/lib/site/template-load'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('site.templates')
  return pageMeta({ title: t('title'), description: t('description'), path: TEMPLATES_PATH, image: pageCard('templates') })
}

/** The free templates (D-36): one card each, leading to its page and its form */
export default async function TemplatesPage() {
  const t = await getTranslations('site')
  const templates = allTemplates()
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-8 px-4 pb-6 pt-8 md:px-gutter md:pt-12">
      <JsonLd
        data={graph(organization(), {
          ...webPage(TEMPLATES_PATH, t('templates.h1'), t('templates.description'), 'CollectionPage'),
          hasPart: templates.map(({ template, content }) => ({ '@type': 'DigitalDocument', name: content.h1, url: absolute(templatePath(template.slug)) })),
        }, breadcrumbs([{ name: t('common.home'), path: '/' }, { name: t('templates.crumb'), path: TEMPLATES_PATH }]))}
      />
      <header className="flex max-w-[760px] flex-col gap-4">
        <Breadcrumb label={t('common.breadcrumb')} trail={[{ name: t('common.home'), path: '/' }]} />
        <h1 className="m-0 font-display text-[44px] font-medium leading-[1.08] tracking-[-0.03em] max-md:text-[32px]">{t('templates.h1')}</h1>
        <p className="m-0 text-[19px] leading-[1.6] text-text-3 max-md:text-[17px]">{t('templates.lead')}</p>
      </header>
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
        {templates.map(({ template, content }) => (
          <li key={template.slug}>
            <Link
              href={templatePath(template.slug) as Route}
              className="group flex h-full flex-col gap-3 rounded-card-lg border border-bar bg-surface p-6 text-ink no-underline hover:text-ink"
            >
              <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-btn bg-accent text-accent-ink">
                <FileText size={20} />
              </span>
              <span className="font-display text-[22px] font-medium leading-[1.2] tracking-[-0.01em]">{content.h1}</span>
              <span className="text-[15px] leading-[1.55] text-text-2">{content.teaser}</span>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[14px] font-semibold group-hover:underline">
                {t('common.getTemplate')}
                <ArrowRight aria-hidden size={15} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { ArticleCards } from '@/components/site/ArticleCards'
import { Blocks } from '@/components/site/Blocks'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { JsonLd } from '@/components/site/JsonLd'
import { TemplateDownload } from '@/components/site/TemplateDownload'
import { pageCard } from '@/lib/site/cards'
import { pageMeta } from '@/lib/site/meta'
import { breadcrumbs, graph, organization, webPage } from '@/lib/site/schema'
import { granted, TEMPLATE_COOKIE, TEMPLATES, TEMPLATES_PATH, templatePath } from '@/lib/site/templates'
import { loadTemplate } from '@/lib/site/template-load'

type Props = { params: Promise<{ slug: string }> }

export const dynamicParams = false
export const generateStaticParams = () => TEMPLATES.map((t) => ({ slug: t.slug }))

export async function generateMetadata(props: Props): Promise<Metadata> {
  const found = loadTemplate((await props.params).slug)
  if (!found) return {}
  const { content: c, template } = found
  return pageMeta({ title: c.title, description: c.description, path: templatePath(template.slug), image: pageCard(`templates/${template.slug}`) })
}

/**
 * A free template's page (D-37): what is in it, how to use it and why it is built that way, with the form
 * beside the heading. The cookie decides whether the files show at once; reading it makes the page render
 * on request.
 */
export default async function TemplatePage(props: Props) {
  const found = loadTemplate((await props.params).slug)
  if (!found) notFound()
  const { template, content: c } = found
  const t = await getTranslations('site')
  const ready = granted((await cookies()).get(TEMPLATE_COOKIE)?.value).includes(template.slug)
  const path = templatePath(template.slug)
  const files = template.files.map((f) => ({ name: f.name, format: f.format, label: c.files[f.name] ?? f.name }))

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col px-4 pb-6 md:px-gutter">
      <JsonLd
        data={graph(
          organization(),
          webPage(path, c.h1, c.description),
          breadcrumbs([
            { name: t('common.home'), path: '/' },
            { name: t('templates.crumb'), path: TEMPLATES_PATH },
            { name: c.crumb, path },
          ]),
        )}
      />
      {/* phones: the heading, then the form, then the text; from 1024 px the form sits beside both */}
      <div className="grid gap-x-14 gap-y-8 pt-8 md:pt-12 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
          <Breadcrumb label={t('common.breadcrumb')} trail={[{ name: t('common.home'), path: '/' }, { name: t('templates.crumb'), path: TEMPLATES_PATH }]} />
          <p className="m-0 self-start rounded-pill bg-accent px-3 py-[5px] text-[12.5px] font-semibold text-accent-ink">{c.kicker}</p>
          <h1 className="m-0 font-display text-[44px] font-medium leading-[1.08] tracking-[-0.03em] max-md:text-[32px]">{c.h1}</h1>
          <p className="m-0 text-[19px] leading-[1.6] text-text-3 max-md:text-[17px]" style={{ textWrap: 'pretty' }}>
            {c.lead}
          </p>
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-10">
          <ClientMessages namespaces={['site']}>
            <TemplateDownload slug={template.slug} files={files} ready={ready} />
          </ClientMessages>
        </div>
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <Blocks blocks={c.blocks} />
        </div>
      </div>
      <section aria-labelledby="read-with" className="mt-14">
        <h2 id="read-with" className="m-0 font-display text-[24px] font-medium tracking-[-0.02em]">
          {t('templates.readWith')}
        </h2>
        <ArticleCards slugs={template.related} className="mt-4" />
      </section>
    </div>
  )
}

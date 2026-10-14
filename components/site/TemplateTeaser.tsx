import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, FileText } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { templatePath } from '@/lib/site/templates'
import { loadTemplate } from '@/lib/site/template-load'

/**
 * The free template that goes with an article, at its foot (Orgpuls D-243): named for what it is, with what
 * is in it and a link to its page. Not an offer: a document for the reader's own work.
 */
export async function TemplateTeaser({ slug }: { slug: string }) {
  const t = await getTranslations('site.common')
  const found = loadTemplate(slug)
  if (!found) return null
  const { content } = found
  return (
    <aside aria-labelledby={`teaser-${slug}`} className="flex flex-col gap-3 rounded-card bg-accent px-6 py-5 text-accent-ink sm:flex-row sm:items-center sm:gap-5">
      <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-btn bg-surface text-ink">
        <FileText size={20} />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em]">{content.kicker}</p>
        <h2 id={`teaser-${slug}`} className="m-0 text-[17px] font-bold text-ink">
          {content.h1}
        </h2>
        <p className="m-0 text-[14.5px] leading-[1.55] max-md:text-[15px]">{content.teaser}</p>
      </div>
      <Link
        href={templatePath(slug) as Route}
        className="inline-flex min-h-[44px] flex-none items-center gap-1.5 self-start rounded-btn bg-ink px-4 py-2.5 text-[14px] font-semibold text-white hover:text-white sm:self-center"
      >
        {t('getTemplate')}
        <ArrowRight aria-hidden size={15} />
      </Link>
    </aside>
  )
}

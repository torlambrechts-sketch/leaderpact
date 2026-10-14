import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArticleView } from '@/components/site/ArticleView'
import { articlePath, PUBLISHED } from '@/lib/site/articles'
import { loadArticle } from '@/lib/site/article-load'
import { articleCard } from '@/lib/site/cards'
import { pageMeta } from '@/lib/site/meta'

type Props = { params: Promise<{ slug: string }> }

/** Only published articles have a page; a planned one, or any other slug, is a 404 */
export const dynamicParams = false
export const generateStaticParams = () => PUBLISHED.map((a) => ({ slug: a.slug }))

export async function generateMetadata(props: Props): Promise<Metadata> {
  const a = loadArticle((await props.params).slug)
  if (!a) return {}
  return pageMeta({
    title: a.content.title,
    description: a.content.description,
    path: articlePath(a.entry.slug),
    type: 'article',
    published: a.entry.published,
    modified: a.entry.modified,
    image: articleCard(a.entry.slug),
  })
}

export default async function ArticlePage(props: Props) {
  const a = loadArticle((await props.params).slug)
  if (!a) notFound()
  return <ArticleView entry={a.entry} content={a.content} />
}

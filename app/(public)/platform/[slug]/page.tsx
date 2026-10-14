import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FeaturePage } from '@/components/site/FeaturePage'
import { pageCard } from '@/lib/site/cards'
import { featureBySlug, featurePath, FEATURES, loadFeature } from '@/lib/site/features'
import { pageMeta } from '@/lib/site/meta'

export const dynamicParams = false

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const c = loadFeature(slug)
  if (!c) return {}
  return pageMeta({ title: c.title, description: c.description, path: featurePath(slug), image: pageCard(`platform/${slug}`) })
}

/** A feature page (D-44); its words are data/features, its frame components/site/FeaturePage */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const entry = featureBySlug(slug)
  const content = loadFeature(slug)
  if (!entry || !content) notFound()
  return <FeaturePage slug={entry.slug} art={entry.art} content={content} related={entry.related} />
}

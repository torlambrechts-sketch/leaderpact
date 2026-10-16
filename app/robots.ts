import type { MetadataRoute } from 'next'
import { absolute, SITE_HOST } from '@/lib/site/config'

/**
 * What crawlers may read (D-34). The private paths are listed so no crawler spends time on them; each of
 * those pages also says noindex itself. Answer engines' crawlers are not singled out: they read what any
 * crawler reads (docs/marketing/seo-geo-strategy.md, section 2).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/app', '/j/', '/p/', '/auth', '/sign-in', '/scan', '/templates/file/', '/specimens'] }],
    sitemap: absolute('/sitemap.xml'),
    host: SITE_HOST,
  }
}

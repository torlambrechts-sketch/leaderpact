'use client'
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next'
import { analyticsUrl } from '@/lib/site/analytics'
import { optedOut } from '@/lib/site/beacon'

/**
 * Vercel Web Analytics (D-69), mounted beside the site's own beacon on the public layout, only on the production
 * deployment. Every event passes analyticsUrl first: a page the beacon never counts, a browser that asks not to be
 * tracked or another host sends nothing, and the address loses its query string bar the campaign tags.
 */
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event: BeforeSendEvent) => {
        const url = analyticsUrl(event.url, optedOut())
        return url ? { ...event, url } : null
      }}
    />
  )
}

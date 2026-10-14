import { PublicChrome } from '@/components/site/PublicChrome'

/**
 * The public site: the landing page, the scan, the personal view, the Leader Profile, the reading pages and the
 * legal pages (handoff 6.1-6.3, 6.17), each in the site's header and footer.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicChrome>{children}</PublicChrome>
}

import type { Metadata } from 'next'
import { NOINDEX } from '@/lib/site/meta'

/** The signed-in app: nothing here is for a search engine (D-34) */
export const metadata: Metadata = { robots: NOINDEX }

export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return children
}

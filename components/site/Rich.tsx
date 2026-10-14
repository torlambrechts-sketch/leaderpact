// Origin: Orgpuls components/marketing/Rich.tsx @ d9b1c52 (adapted: internal links only).
import Link from 'next/link'
import type { Route } from 'next'
import * as React from 'react'

/**
 * Text with the two inline marks the site's data files allow (lib/site/blocks.ts): `**bold**` and
 * `[label](/path)`. The schema has already refused a link that leaves the site, so every link is a Link.
 */
const MARK = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g

export function Rich({ text }: { text: string }) {
  const out: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(MARK)) {
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    if (m[1] !== undefined) out.push(<strong key={at}>{m[1]}</strong>)
    else
      out.push(
        <Link key={at} href={(m[3] ?? '/') as Route} className="text-link underline decoration-1 underline-offset-2">
          {m[2]}
        </Link>,
      )
    last = at + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}

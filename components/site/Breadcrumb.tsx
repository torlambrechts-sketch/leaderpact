import Link from 'next/link'
import type { Route } from 'next'

/** The visible trail above a page's heading; the page's own name is its heading, so the trail stops before it */
export function Breadcrumb({ label, trail }: { label: string; trail: { name: string; path: string }[] }) {
  return (
    <nav aria-label={label} className="text-[13px] text-text-2 max-md:text-[15px]">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
        {trail.map((c, i) => (
          <li key={c.path} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden>/</span> : null}
            <Link href={c.path as Route} className="text-text-2 hover:text-ink max-md:inline-flex max-md:min-h-[44px] max-md:min-w-[44px] max-md:items-center">
              {c.name}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}

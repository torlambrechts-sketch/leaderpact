import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * A signed-in page's frame (handoff section 4, Layout): centred under the top bar, 1176 px of content at
 * 1280, a 16 px gutter on a phone, cards 20 px apart. The page title block is the design's: the group's
 * name at 13 px over a 32 px title, with the page's tabs on the right.
 */
export function AppPage({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto mt-6 flex max-w-[1280px] flex-col gap-5 px-4 md:mt-[26px] md:px-8 xl:px-[52px]', className)}>{children}</div>
}

export function PageTitle({ eyebrow, title, aside }: { eyebrow?: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{eyebrow}</p>}
        <h1 className="m-0 font-display text-page-title max-md:text-[28px]">{title}</h1>
      </div>
      {aside}
    </div>
  )
}

/** A page that could not be shown: a failed read, or a group that is not the reader's */
export function PageProblem({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mx-auto mt-6 max-w-[720px] px-4 md:mt-10 md:px-6">
      <section className="flex flex-col gap-4 rounded-card-lg border border-white bg-surface p-6 md:p-9">
        <h1 className="m-0 font-display text-sub-headline">{title}</h1>
        {body && <p className="m-0 text-[15px] text-text-2">{body}</p>}
      </section>
    </div>
  )
}

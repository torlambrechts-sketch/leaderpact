import * as React from 'react'

/**
 * A plain page for legal text (handoff 6.1): the privacy and data-processing pages. Their text is the
 * owner's to supply (`TODO(owner)` in each page); until then the page says plainly that it is not written.
 */
export function LegalPage({ heading, body }: { heading: string; body: string }) {
  return (
    // in the site's frame (D-48), at its left edge like every other page, the text at the reading measure
    <div className="mx-auto mt-10 max-w-site px-4 md:mt-14 md:px-gutter">
      <div className="flex max-w-[760px] flex-col gap-4">
        <h1 className="m-0 font-display text-page-title max-md:text-[28px]">{heading}</h1>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{body}</p>
      </div>
    </div>
  )
}

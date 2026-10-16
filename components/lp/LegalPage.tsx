import * as React from 'react'

/**
 * A plain page for legal text (handoff 6.1): the privacy and data-processing pages. A page whose text is not
 * written yet passes `body`, which says so (the data-processing page, `TODO(owner)`); a written one passes its
 * lead and sections as children (the privacy notice, D-61).
 */
export function LegalPage({ heading, body, children }: { heading: string; body?: string; children?: React.ReactNode }) {
  return (
    // in the site's frame (D-48), at its left edge like every other page, the text at the reading measure
    <div className="mx-auto mt-10 max-w-site px-4 pb-10 md:mt-14 md:px-gutter">
      <div className="flex max-w-[760px] flex-col gap-4">
        <h1 className="m-0 font-display text-page-title max-md:text-[28px]">{heading}</h1>
        {body ? <p className="m-0 text-[15px] leading-[1.55] text-text-2">{body}</p> : null}
        {children}
      </div>
    </div>
  )
}

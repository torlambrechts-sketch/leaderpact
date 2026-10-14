import * as React from 'react'
import { headingIds, plain, type Block } from '@/lib/site/blocks'
import { Rich } from './Rich'

/**
 * One renderer per block kind (lib/site/blocks.ts): the articles, the template pages and the product pages
 * all draw their long text with it. Body text is 17 px at 1.7 on the page, 15 px on a phone at the least
 * (handoff section 4); headings are Poppins, the display face.
 */
export function Blocks({ blocks }: { blocks: Block[] }) {
  const ids = headingIds(blocks)
  return (
    <div className="flex flex-col gap-5 text-[17px] leading-[1.7] text-text-body">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} id={ids.get(i)} />
      ))}
    </div>
  )
}

function BlockView({ block: b, id }: { block: Block; id?: string }) {
  switch (b.t) {
    case 'h2':
      return (
        <h2 id={id} className="m-0 mt-6 scroll-mt-6 font-display text-[26px] font-medium leading-[1.2] tracking-[-0.02em] text-ink max-md:text-[23px]">
          <Rich text={b.text} />
        </h2>
      )
    case 'h3':
      return (
        <h3 className="m-0 mt-2 text-[19px] font-bold leading-[1.3] text-ink">
          <Rich text={b.text} />
        </h3>
      )
    case 'p':
      return (
        <p className="m-0" style={{ textWrap: 'pretty' }}>
          <Rich text={b.text} />
        </p>
      )
    case 'ul':
      return (
        <ul className="m-0 flex list-disc flex-col gap-2 pl-6 marker:text-text-2">
          {b.items.map((item, i) => (
            <li key={i}>
              <Rich text={item} />
            </li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol className="m-0 flex list-decimal flex-col gap-2 pl-6 marker:font-semibold marker:text-text-2">
          {b.items.map((item, i) => (
            <li key={i}>
              <Rich text={item} />
            </li>
          ))}
        </ol>
      )
    case 'box':
      return (
        <aside className="flex flex-col gap-2 rounded-card border border-bar bg-surface px-6 py-5">
          <p className="m-0 text-[15px] font-bold text-ink">
            <Rich text={b.title} />
          </p>
          <p className="m-0 text-[16px] leading-[1.6]">
            <Rich text={b.text} />
          </p>
        </aside>
      )
    case 'cards':
      return (
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
          {b.items.map((item, i) => (
            <li key={i} className="flex flex-col gap-1.5 rounded-card bg-surface px-5 py-4">
              <p className="m-0 text-[16px] font-bold text-ink">
                <Rich text={item.title} />
              </p>
              <p className="m-0 text-[15px] leading-[1.6] text-text-2">
                <Rich text={item.text} />
              </p>
            </li>
          ))}
        </ul>
      )
    case 'table':
      return (
        // a table wider than a phone scrolls inside its box, which takes focus so a keyboard can scroll it
        <div tabIndex={0} role="region" aria-label={plain(b.head.join(', '))} className="overflow-x-auto rounded-card border border-bar bg-surface">
          <table className="w-full border-collapse text-left text-[15px] leading-[1.5]">
            <thead>
              <tr>
                {b.head.map((h, i) => (
                  <th key={i} scope="col" className="border-b border-bar px-4 py-3 align-bottom font-bold text-ink">
                    <Rich text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, r) => (
                <tr key={r} className="border-b border-rule-softer last:border-b-0">
                  {row.map((cell, c) =>
                    c === 0 ? (
                      <th key={c} scope="row" className="px-4 py-3 align-top font-semibold text-ink">
                        <Rich text={cell} />
                      </th>
                    ) : (
                      <td key={c} className="px-4 py-3 align-top">
                        <Rich text={cell} />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

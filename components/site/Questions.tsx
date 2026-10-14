import { Rich } from './Rich'

/**
 * A page's questions and answers, which its FAQPage data repeats word for word. Across the frame (D-48): from
 * 1024 px the heading stands in the left column, as a section's does, and the questions beside it.
 */
export function Questions({ title, faq, className }: { title: string; faq: readonly { q: string; a: string }[]; className?: string }) {
  return (
    <section aria-labelledby="questions" className={`grid gap-5 lg:grid-cols-12 lg:gap-x-12 ${className ?? ''}`}>
      <h2 id="questions" className="m-0 font-display text-[26px] font-medium tracking-[-0.02em] lg:sticky lg:top-6 lg:col-span-4 lg:self-start">
        {title}
      </h2>
      <dl className="m-0 flex flex-col gap-3 lg:col-span-8">
        {faq.map((f, i) => (
          <div key={i} className="rounded-card bg-surface px-6 py-5">
            <dt className="text-[16.5px] font-bold text-ink">
              <Rich text={f.q} />
            </dt>
            <dd className="m-0 mt-2 text-[15.5px] leading-[1.6] text-text-body">
              <Rich text={f.a} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

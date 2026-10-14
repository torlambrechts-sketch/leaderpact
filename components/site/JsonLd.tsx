// Origin: Orgpuls components/marketing/JsonLd.tsx @ d9b1c52.
/** Structured data for a page; `<` is escaped so no value can close the script element */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
}

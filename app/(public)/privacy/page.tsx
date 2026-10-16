import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PRODUCT_NAME } from '@/lib/brand'
import { Blocks } from '@/components/site/Blocks'
import { Rich } from '@/components/site/Rich'
import { LegalPage } from '@/components/lp/LegalPage'
import { CONTACT_MAIL, PUBLISHER } from '@/lib/site/config'
import { formatDay } from '@/lib/site/dates'
import { loadLegal } from '@/lib/site/legal'
import { NOINDEX } from '@/lib/site/meta'

export async function generateMetadata(): Promise<Metadata> {
  const c = loadLegal('privacy')
  // TODO(owner): indexed once the notice names the company responsible (PUBLISHER); until then it stays out of search
  return { title: c.title, description: c.description, robots: NOINDEX }
}

/**
 * The privacy notice (D-61): what LeaderPact keeps about a person, why, for how long, who helps, and the person's
 * rights, written from what the code and the database do. The words are data (data/pages/privacy.json).
 *
 * Who is responsible comes first, from PUBLISHER: TODO(owner), the legal name and registration of the company
 * that publishes LeaderPact. Until it is given, the page says plainly that the name is not on it yet, and never
 * borrows another company's.
 */
export default async function PrivacyPage() {
  const t = await getTranslations('legal')
  const c = loadLegal('privacy')
  const mail = (chunks: React.ReactNode) => (
    <a href={`mailto:${CONTACT_MAIL}`} className="text-link underline decoration-1 underline-offset-2">
      {chunks}
    </a>
  )
  return (
    <LegalPage heading={c.h1}>
      <p className="m-0 text-[19px] leading-[1.6] text-text-3 max-md:text-[17px]">
        <Rich text={c.lead} />
      </p>
      <p className="m-0 text-[14px] text-text-2">{t('updated', { date: formatDay(c.updated) })}</p>
      <section aria-labelledby="responsible" className="mt-4 flex flex-col gap-4 text-[17px] leading-[1.7] text-text-body">
        <h2 id="responsible" className="m-0 font-display text-[26px] font-medium leading-[1.2] tracking-[-0.02em] max-md:text-[22px]">
          {t('responsibleTitle')}
        </h2>
        <p className="m-0">
          {PUBLISHER.legalName
            ? t('responsibleNamed', { company: PUBLISHER.legalName, product: PRODUCT_NAME })
            : t('responsiblePending', { product: PRODUCT_NAME })}
        </p>
        <p id="contact" className="m-0">
          {t.rich('contact', { address: CONTACT_MAIL, mail })}
        </p>
      </section>
      <div className="mt-6">
        <Blocks blocks={c.blocks} />
      </div>
    </LegalPage>
  )
}

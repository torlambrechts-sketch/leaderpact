import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { LANDING_PATH } from '@/lib/routes'

/** The scan could not be read (lib/scan/load.ts logged why). Nothing is shown in its place. */
export async function ScanUnavailable() {
  const t = await getTranslations('scan')
  return (
    <div className="mx-auto mt-6 max-w-questionnaire px-4 md:mt-10 md:px-6">
      <section className="flex flex-col gap-3 rounded-card-lg border border-white bg-surface p-6 md:p-9">
        <h1 className="m-0 font-display text-sub-headline">{t('unavailableTitle')}</h1>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('unavailableBody')}</p>
        <Link href={LANDING_PATH as Route} className="text-link self-start text-[15px] font-semibold text-ink underline underline-offset-2 max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
          {t('unavailableBack')}
        </Link>
      </section>
    </div>
  )
}

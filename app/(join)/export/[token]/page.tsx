import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Download } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { PRODUCT_NAME } from '@/lib/brand'
import { exportTokenSchema } from '@/lib/export/files'
import { exportPath } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('exportTitle', { product: PRODUCT_NAME }), robots: { index: false } }
}

const STATES = ['used', 'expired', 'unknown', 'failed'] as const
type State = (typeof STATES)[number]

/**
 * The export's mailed link (handoff 6.18; owner D6). Opening it uses nothing: the button posts to the download,
 * which answers the file once (0023), so a mail scanner that opens every link leaves it working. A used, expired
 * or unknown link comes back here and says so. The token in the path is the capability; the page reads nothing
 * with it until the button is pressed.
 */
export default async function ExportPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ state?: string }> }) {
  const [{ token }, { state: asked }] = await Promise.all([params, searchParams])
  const t = await getTranslations('exportFile')
  const state: State | null = !exportTokenSchema.safeParse(token).success ? 'unknown' : STATES.find((s) => s === asked) ?? null

  return (
    <div className="mx-auto mt-6 max-w-questionnaire px-4 md:mt-10 md:px-6">
      <section className="flex flex-col gap-4 rounded-card-lg border border-white bg-surface p-6 md:p-9">
        {state === 'failed' ? (
          <h1 className="m-0 font-display text-sub-headline">{t('failed')}</h1>
        ) : state ? (
          <>
            <h1 className="m-0 font-display text-sub-headline">{t(`${state}Title`)}</h1>
            <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t(`${state}Body`)}</p>
          </>
        ) : (
          <>
            <h1 className="m-0 font-display text-sub-headline">{t('heading')}</h1>
            <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('lead', { product: PRODUCT_NAME })}</p>
            <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('noAnswers')}</p>
            <form method="post" action={`${exportPath(token)}/download`} className="flex flex-col gap-2">
              <button type="submit" className={buttonVariants({ className: 'gap-2 self-start' })}>
                <Download aria-hidden size={16} />
                {t('download')}
              </button>
              <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('once')}</p>
            </form>
          </>
        )}
      </section>
    </div>
  )
}

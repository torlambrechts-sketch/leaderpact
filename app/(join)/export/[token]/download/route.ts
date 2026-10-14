import { NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { PRODUCT_NAME } from '@/lib/brand'
import { downloadReplySchema, exportArchive, exportTokenSchema } from '@/lib/export/files'
import { dateFormat } from '@/lib/i18n/dates'
import { exportPath } from '@/lib/routes'
import { anonClient } from '@/lib/supabase/anon'
import { callFailed, parseFailed } from '@/lib/supabase/read'

/**
 * The export's one-time link, pressed (handoff 6.18; owner D6): the content once, within 24 hours of the mail,
 * as a ZIP (0023 download_export empties it as it answers). A POST, so a mail scanner opening the link does
 * not use it up. Anything else goes back to the page, which says why. Nothing of the content is logged.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  // a relative address: the host Next reads behind a proxy is not always the one the browser used
  const back = (state: string) => new NextResponse(null, { status: 303, headers: { Location: `${exportPath(encodeURIComponent(token))}?state=${state}`, 'Cache-Control': 'no-store' } })
  if (!exportTokenSchema.safeParse(token).success) return back('unknown')

  const client = anonClient()
  if (!client) return back('failed')
  const { data, error } = await client.schema('app').rpc('download_export', { p_token: token })
  if (callFailed('downloadExport', error)) return back('failed')
  const reply = downloadReplySchema.safeParse(data)
  if (parseFailed('downloadExport', reply)) return back('failed')
  if (!reply.data.ok) return back(reply.data.reason)

  const t = await getTranslations({ locale: 'en', namespace: 'exportFile' })
  const now = new Date()
  const date = dateFormat({ locale: 'en', timeZone: 'UTC' }, { day: 'numeric', month: 'long', year: 'numeric' }).format(now)
  const readme = [t('readme1', { product: PRODUCT_NAME, date }), t('readme2'), t('readme3'), t('readme4')]
  const archive = exportArchive(reply.data.content, readme, now)
  return new NextResponse(Buffer.from(archive.bytes), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${archive.name}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

import { createTranslator } from 'next-intl'
import messages from '@/messages/en.json'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { dateFormat } from '@/lib/i18n/dates'
import { linkLevelSchema } from '@/lib/profile/link-io'
import { loadMyProfile, loadPersonName } from '@/lib/profile/load'
import { profilePdf } from '@/lib/profile/pdf'
import { SITE_HOST } from '@/lib/site/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The signed-in person's Leader Profile as a PDF to send (D-66), at the level they chose on Me: the domains, or the
 * domains and facets. Bands only, as a private link shows it, with the labels every result carries. Their own
 * profile only: the route reads it through row-level security, and takes no person from the address.
 */
export async function GET(request: Request) {
  const user = await currentUser()
  if (!user) return new Response(null, { status: 401 })
  const level = linkLevelSchema.safeParse(new URL(request.url).searchParams.get('level') ?? 'domains')
  if (!level.success) return new Response(null, { status: 400 })
  const [profile, name] = await Promise.all([loadMyProfile(user.id), loadPersonName(user.id)])
  if (profile === null) return new Response(null, { status: 503 })
  if (profile === 'none') return new Response(null, { status: 404 })

  const t = createTranslator({ locale: 'en', messages })
  const day = dateFormat({ locale: 'en', timeZone: 'UTC' }, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(profile.takenAt))
  const test = t(profile.test.key === 'quick' ? 'profile.result.testQuick' : 'profile.result.testFull', { name: profile.test.name, items: profile.test.items })
  const bytes = await profilePdf({
    name: name ?? t('me.title'),
    meta: t('profileShared.meta', { test, date: day }),
    domains: profile.domains.map(({ key, domain, name: n, band }) => ({ key, domain, name: n, band })),
    facets: level.data === 'facets' ? profile.facets.map(({ key, domain, name: n, band }) => ({ key, domain, name: n, band })) : [],
    words: {
      title: t('profile.title'),
      domains: t('profile.result.domains'),
      facetsOf: (domain) => t('profile.result.facetsOf', { domain }),
      bands: { lower: t('profile.result.band_lower'), middle: t('profile.result.band_middle'), higher: t('profile.result.band_higher') },
      notes: [t('profileShared.scaleNote'), t('profileShared.notGrade'), t('profile.label'), t('profile.purpose')],
      footer: `${PRODUCT_NAME} · ${SITE_HOST}`,
      page: (n, total) => t('me.pdfPage', { n, total }),
    },
  })
  return new Response(Buffer.from(bytes), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': 'attachment; filename="leader-profile.pdf"',
      'cache-control': 'private, no-store',
    },
  })
}

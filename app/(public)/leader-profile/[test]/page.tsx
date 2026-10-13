import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadBandSet, loadMyProfile, loadProfileTest } from '@/lib/profile/load'
import { PROFILE_PATH } from '@/lib/routes'
import { ProfileRun } from './ProfileRun'

export const dynamic = 'force-dynamic'

const TESTS = ['quick', 'full'] as const
type TestKey = (typeof TESTS)[number]
const isTest = (value: string): value is TestKey => (TESTS as readonly string[]).includes(value)

export async function generateMetadata({ params }: { params: Promise<{ test: string }> }): Promise<Metadata> {
  const { test } = await params
  const [t, tp] = await Promise.all([getTranslations('meta'), getTranslations('profile')])
  const name = test === 'full' ? tp('fullTitle') : tp('quickTitle')
  return { title: t('profileTestTitle', { test: name, product: PRODUCT_NAME }) }
}

/**
 * One of the Leader Profile's tests (handoff 6.17), taken with or without an account: the published test's
 * items, answered on the device, then the result, computed on the device too (lib/profile/score.ts).
 * A signed-in person keeps it in one step; a visitor keeps it by email sign-in (`ProfileRun`).
 */
export default async function ProfileTestPage({ params }: { params: Promise<{ test: string }> }) {
  const { test: key } = await params
  if (!isTest(key)) notFound()
  const [test, bands, user] = await Promise.all([loadProfileTest(key), loadBandSet(), currentUser()])
  if (!test || !bands) {
    const t = await getTranslations('profile')
    return (
      <div className="mx-auto mt-6 max-w-questionnaire px-4 md:mt-10 md:px-6">
        <section className="flex flex-col gap-3 rounded-card-lg border border-white bg-surface p-6 md:p-9">
          <h1 className="m-0 font-display text-sub-headline">{t('unavailableTitle')}</h1>
          <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('unavailableBody')}</p>
          <Link href={PROFILE_PATH as Route} className="text-link self-start text-[15px] font-semibold text-ink underline underline-offset-2 max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
            {t('unavailableBack')}
          </Link>
        </section>
      </div>
    )
  }
  const existing = user ? await loadMyProfile(user.id) : null
  return (
    <ClientMessages namespaces={['profile']}>
      <ProfileRun test={test} bands={bands} signedIn={user !== null} replaces={existing !== null && existing !== 'none'} />
    </ClientMessages>
  )
}

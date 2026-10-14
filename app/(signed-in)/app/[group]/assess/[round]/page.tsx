import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageProblem } from '@/components/app/AppPage'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { dateFormat } from '@/lib/i18n/dates'
import { loadRoundForm } from '@/lib/rounds/load'
import { SIGN_IN_PATH, assessPath } from '@/lib/routes'
import { RoundFlow } from './RoundFlow'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('roundTitle', { product: PRODUCT_NAME }) }
}

/**
 * One round's questionnaire (handoff 6.11), for a current member of its group. The questions come in the
 * round's mixed order only while the reader is asked and has yet to answer (`get_round_form`, 0015); a round
 * of another group, or none, reads as not found.
 */
export default async function RoundPage({ params }: { params: Promise<{ group: string; round: string }> }) {
  const { group, round } = await params
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const tInvite = await getTranslations('invite')
  const form = await loadRoundForm(round)
  if (form === null) return <PageProblem title={tInvite('readFailed')} />
  if (form === 'none' || form.team !== group) return <PageProblem title={tInvite('notFoundTitle')} body={tInvite('notFoundBody')} />
  if (form.state === 'open' && !form.items?.length) return <PageProblem title={tInvite('readFailed')} />

  const day = (iso: string) => dateFormat({ locale: 'en', timeZone: 'UTC' }, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
  return (
    <ClientMessages namespaces={['round', 'scan']}>
      <RoundFlow
        round={form.round}
        kind={form.kind}
        number={form.number ?? null}
        person={user.id}
        version={form.version}
        state={form.state}
        items={form.items ?? []}
        group={form.group}
        closes={form.closes_at ? day(form.closes_at) : null}
        k={form.k}
        backHref={assessPath(group)}
      />
    </ClientMessages>
  )
}

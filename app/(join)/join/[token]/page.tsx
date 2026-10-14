import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadInvitation } from '@/lib/group/load'
import { tokenSchema } from '@/lib/group/schema'
import { homePath } from '@/lib/routes'
import { JoinNow, JoinSignIn } from './JoinActions'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('joinGroupTitle', { product: PRODUCT_NAME }), robots: { index: false } }
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-6 max-w-questionnaire px-4 md:mt-10 md:px-6">
      <section className="flex flex-col gap-4 rounded-card-lg border border-white bg-surface p-6 md:p-9">{children}</section>
    </div>
  )
}

/**
 * An invitation to join a group (handoff 6.8; 0014). The token in the path is the capability: the page shows
 * which group asks and whom, never the address. Signed out, the person enters the address the invitation
 * names and gets a sign-in link, which may make their account; any other address is told so. Signed in,
 * they join, and land on the group's Home; someone already in the group goes straight there. A withdrawn,
 * used or expired link says so.
 */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const t = await getTranslations('invitation')
  const valid = tokenSchema.safeParse(token).success
  const invitation = valid ? await loadInvitation(token) : 'none'
  if (invitation === null) {
    return (
      <Frame>
        <h1 className="m-0 font-display text-sub-headline">{t('readFailed')}</h1>
      </Frame>
    )
  }
  // someone already in the group: the link takes them there
  if (invitation !== 'none' && invitation.team) redirect(homePath(invitation.team) as Route)
  if (invitation === 'none' || invitation.state !== 'open') {
    const state = invitation === 'none' ? 'unknown' : invitation.state
    return (
      <Frame>
        <h1 className="m-0 font-display text-sub-headline">{t(`${state}Title`)}</h1>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">
          {invitation === 'none' ? t('unknownBody') : t(`${state}Body`, { leader: invitation.leader ?? t('theLeader') })}
        </p>
      </Frame>
    )
  }

  const user = await currentUser()
  return (
    <ClientMessages namespaces={['invitation']}>
      <Frame>
        <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{invitation.group}</p>
        <h1 className="m-0 font-display text-sub-headline">
          {invitation.leader ? t('heading', { leader: invitation.leader, group: invitation.group }) : t('headingNoLeader', { group: invitation.group })}
        </h1>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('body', { name: invitation.name })}</p>
        {user ? <JoinNow token={token} group={invitation.group} email={user.email ?? ''} /> : <JoinSignIn token={token} />}
        <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('note')}</p>
      </Frame>
    </ClientMessages>
  )
}

'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'
import { Avatar } from '@/components/lp/Avatar'
import { Card } from '@/components/lp/Card'
import { CopyLink } from '@/components/lp/CopyLink'
import { Pill } from '@/components/lp/Pill'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { TextField } from '@/components/lp/TextField'
import { Button } from '@/components/ui/button'
import { inviteMember, removeMember, revokeInvitation, setLeader } from '@/lib/group/actions'
import { emailSchema } from '@/lib/auth/schema'
import type { GroupReason } from '@/lib/group/schema'

export interface MembersProps {
  group: { id: string; name: string }
  members: { person: string; name: string; role: 'leader' | 'member'; since: string; me: boolean }[]
  invitations: { id: string; name: string; email: string; invited: string; expired: boolean }[] | null
  max: number
  invitationDays: number
  canInvite: boolean
  canManage: boolean
  /** the site's address, for the invitation link */
  origin: string
}

type Asking = { kind: 'remove' | 'leader'; person: string; name: string } | null
type Link = { name: string; email: string; link: string } | null

/**
 * Members (handoff 6.8, design `group` members tab): who is in the group, with role and start date and no
 * counts per person (section 11). The leader invites by name and address, and copies the link to send: no
 * invitation mail exists until the outbox (milestone 16, D-26), so the leader sends it (D-41). The leader
 * withdraws an invitation, removes a member (access ends at once) and names another leader. Up to 15,
 * invitations counted.
 */
export function MembersArea(props: MembersProps) {
  const t = useTranslations('group')
  const router = useRouter()
  const { group, members, invitations, max, canInvite, canManage } = props
  const [asking, setAsking] = React.useState<Asking>(null)
  const [busy, setBusy] = React.useState(false)
  const [problem, setProblem] = React.useState<string | null>(null)
  const [link, setLink] = React.useState<Link>(null)
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [fieldError, setFieldError] = React.useState<{ name?: string; email?: string }>({})
  const askRef = React.useRef<HTMLParagraphElement>(null)
  const linkRef = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (asking) askRef.current?.focus()
  }, [asking])
  React.useEffect(() => {
    if (link) linkRef.current?.focus()
  }, [link])

  const count = members.length + (invitations?.filter((i) => !i.expired).length ?? 0)
  const say = (reason: GroupReason, address?: string) =>
    setProblem(
      reason === 'already_member'
        ? t('alreadyMember', { email: address ?? '' })
        : reason === 'full'
          ? t('full', { max })
          : reason === 'unavailable'
            ? t('invitePaused')
            : reason === 'invalid'
              ? t('inviteInvalid')
              : t('writeFailed'),
    )

  async function invite(person: { name: string; email: string }) {
    setBusy(true)
    setProblem(null)
    setLink(null)
    const result = await inviteMember({ group: group.id, ...person }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setBusy(false)
    if (!result.ok || !result.token) return say(result.ok ? 'failed' : result.reason, person.email)
    setLink({ ...person, link: `${props.origin}/join/${result.token}` })
    setName('')
    setEmail('')
    router.refresh()
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const address = emailSchema.safeParse(email)
    const errors = { name: name.trim() ? undefined : t('nameRequired'), email: address.success ? undefined : t('emailRequired') }
    setFieldError(errors)
    if (errors.name || errors.email || !address.success) return
    void invite({ name: name.trim(), email: address.data })
  }

  async function confirm() {
    if (!asking) return
    setBusy(true)
    setProblem(null)
    const input = { group: group.id, person: asking.person }
    const result = await (asking.kind === 'remove' ? removeMember(input) : setLeader(input)).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setBusy(false)
    setAsking(null)
    if (!result.ok) return say(result.reason)
    router.refresh()
  }

  async function withdraw(invitation: string) {
    setBusy(true)
    setProblem(null)
    const result = await revokeInvitation({ group: group.id, invitation }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setBusy(false)
    if (!result.ok) return say(result.reason)
    setLink(null)
    router.refresh()
  }

  return (
    <div className="grid items-start gap-5 min-[960px]:grid-cols-[minmax(0,1fr)_380px]">
      <Card large>
        <SectionHeader title={t('membersTitle')} meta={t('membersMeta', { count, max })} />
        <ul aria-label={t('membersTitle')} className="m-0 list-none p-0">
          {members.map((m) => (
            <li key={m.person} className="flex flex-col gap-2 border-t border-divider py-3">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar personId={m.person} name={m.name} />
                <div className="flex min-w-[180px] flex-1 basis-[180px] flex-col gap-0.5">
                  <span className="text-[14px] font-bold max-md:text-[15px]">{m.me ? t('meName', { name: m.name }) : m.name}</span>
                  <span className="text-[12.5px] text-muted max-md:text-[15px]">
                    {t('memberLine', { role: m.role === 'leader' ? t('leader') : t('member'), date: m.since })}
                  </span>
                </div>
                {canManage && m.role === 'member' && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="compact" disabled={busy} onClick={() => setAsking({ kind: 'leader', person: m.person, name: m.name })}>
                      {t('makeLeader')}
                    </Button>
                    <Button variant="danger" size="compact" disabled={busy} onClick={() => setAsking({ kind: 'remove', person: m.person, name: m.name })}>
                      {t('remove')}
                    </Button>
                  </div>
                )}
              </div>
              {asking?.person === m.person && (
                <div className="flex flex-col gap-3 rounded-option border-[1.5px] border-line-strong bg-surface-soft p-4">
                  <p ref={askRef} tabIndex={-1} className="m-0 text-[14px] font-bold focus-visible:outline-none max-md:text-[15px]">
                    {asking.kind === 'remove' ? t('removeAsk', { name: m.name, group: group.name }) : t('leaderAsk', { name: m.name })}
                  </p>
                  <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{asking.kind === 'remove' ? t('removeBody') : t('leaderBody')}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant={asking.kind === 'remove' ? 'danger' : 'primary'} disabled={busy} onClick={confirm}>
                      {busy ? t('working') : asking.kind === 'remove' ? t('removeConfirm') : t('leaderConfirm')}
                    </Button>
                    <Button variant="secondary" disabled={busy} onClick={() => setAsking(null)}>
                      {t('notYet')}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {invitations && invitations.length > 0 && (
          <>
            <h3 className="m-0 mt-3 text-[14px] font-bold max-md:text-[15px]">{t('invitationsTitle')}</h3>
            <ul aria-label={t('invitationsTitle')} className="m-0 list-none p-0">
              {invitations.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 border-t border-divider py-3">
                  <div className="flex min-w-[200px] flex-1 basis-[200px] flex-col gap-0.5">
                    <span className="text-[14px] font-bold max-md:text-[15px]">{i.name}</span>
                    <span className="break-words text-[12.5px] text-muted max-md:text-[15px]">{t('invitationLine', { email: i.email, date: i.invited })}</span>
                  </div>
                  <Pill tone={i.expired ? 'neutral' : 'pending'}>{i.expired ? t('expired') : t('invited')}</Pill>
                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      {canInvite && (
                        <Button variant="secondary" size="compact" disabled={busy} onClick={() => invite({ name: i.name, email: i.email })}>
                          {t('newLink')}
                        </Button>
                      )}
                      <Button variant="secondary" size="compact" disabled={busy} onClick={() => withdraw(i.id)}>
                        {t('withdraw')}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="m-0 border-t border-divider pt-3 text-[12.5px] text-muted max-md:text-[15px]">{t('membersNote')}</p>
      </Card>

      <div className="flex flex-col gap-4">
        {problem && (
          <p role="alert" className="m-0 rounded-btn bg-flag-bg px-4 py-3 text-[13.5px] font-semibold max-md:text-[15px]">
            {problem}
          </p>
        )}
        {link && (
          <Card large className="flex flex-col gap-3">
            <p ref={linkRef} tabIndex={-1} className="m-0 text-[14px] font-bold focus-visible:outline-none max-md:text-[15px]">
              {t('linkTitle', { name: link.name })}
            </p>
            <p className="m-0 break-words text-[13.5px] text-text-2 max-md:text-[15px]">{t('linkBody', { email: link.email, days: props.invitationDays })}</p>
            <CopyLink id="invitation-link" link={link.link} labels={{ field: t('linkField'), copy: t('copy'), copied: t('copied'), failed: t('copyFailed') }} />
          </Card>
        )}
        {canInvite ? (
          <Card large className="flex flex-col gap-3">
            <h3 className="m-0 text-[16px] font-bold">{t('inviteTitle')}</h3>
            <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('inviteBody')}</p>
            <form noValidate onSubmit={submit} className="flex flex-col gap-3">
              <TextField id="invite-name" label={t('nameLabel')} value={name} onChange={(e) => setName(e.target.value)} error={fieldError.name} maxLength={120} autoComplete="off" />
              <TextField
                id="invite-email"
                type="email"
                label={t('emailLabel')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldError.email}
                maxLength={254}
                autoComplete="off"
              />
              <Button type="submit" disabled={busy || count >= max} className="self-start">
                {busy ? t('working') : t('invite')}
              </Button>
              {count >= max && <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('full', { max })}</p>}
            </form>
          </Card>
        ) : (
          <p className="m-0 flex items-center gap-2 rounded-btn bg-surface px-3.5 py-3 text-[13px] text-text-2 max-md:text-[15px]">
            <Lock aria-hidden size={15} className="shrink-0 text-ink" />
            {canManage ? t('invitePaused') : t('onlyLeaderManages')}
          </p>
        )}
      </div>
    </div>
  )
}

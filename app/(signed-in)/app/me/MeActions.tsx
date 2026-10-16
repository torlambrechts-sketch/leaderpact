'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CopyLink } from '@/components/lp/CopyLink'
import { Button, buttonVariants } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { deleteProfile, endProfileLink, makeProfileLink, saveProfile, setProfileShare } from '@/lib/profile/actions'
import { PENDING_KEY, draftKey, readPending, remove } from '@/lib/profile/device'
import { deviceStore } from '@/lib/scan/draft'
import { cn } from '@/lib/cn'
import { PROFILE_PDF_PATH, profileLinkPath } from '@/lib/routes'

type Level = 'nothing' | 'domains' | 'facets'
const LEVELS: readonly Level[] = ['nothing', 'domains', 'facets']

/**
 * What one group sees of the person's profile (handoff 6.17): nothing, the domains, or the domains and
 * facets. It applies at once: each choice goes to `set_profile_share`, and the page is read again. A
 * failure puts the choice back and says so.
 */
export function ShareChoice({ group, level }: { group: { id: string; name: string }; level: Level }) {
  const t = useTranslations('me')
  const router = useRouter()
  const [value, setValue] = React.useState<Level>(level)
  const [said, setSaid] = React.useState<'saved' | 'failed' | null>(null)
  const [pending, start] = React.useTransition()
  const id = `share-${group.id}`

  function change(next: string) {
    if (!LEVELS.includes(next as Level)) return
    const previous = value
    setValue(next as Level)
    setSaid(null)
    start(async () => {
      const result = await setProfileShare({ group: group.id, level: next }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
      if (!result.ok) {
        setValue(previous)
        setSaid('failed')
        return
      }
      setSaid('saved')
      router.refresh()
    })
  }

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-busy={pending}>
      <legend id={`${id}-legend`} className="mb-2 text-[14px] font-bold max-md:text-[15px]">
        {t('shareGroup', { group: group.name })}
      </legend>
      <RadioGroup aria-labelledby={`${id}-legend`} value={value} onValueChange={change} className="flex flex-col gap-2">
        {LEVELS.map((l) => (
          <RadioGroupItem
            key={l}
            value={l}
            className="group flex w-full items-start gap-3 rounded-option border-[1.5px] border-line bg-surface px-3.5 py-3 text-left data-[state=checked]:border-ink data-[state=checked]:bg-accent"
          >
            <span aria-hidden className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-[1.5px] border-line group-data-[state=checked]:border-ink">
              <span className="hidden h-2 w-2 rounded-full bg-ink group-data-[state=checked]:block" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[14px] font-semibold text-ink max-md:text-[15px]">{t(`level_${l}`)}</span>
              <span className="text-[12.5px] text-text-2 max-md:text-[15px]">{t(`level_${l}Body`)}</span>
            </span>
          </RadioGroupItem>
        ))}
      </RadioGroup>
      <p role="status" className="m-0 min-h-[1em] text-[12.5px] font-semibold max-md:text-[15px]">
        {said === 'saved' ? t('shareSaved') : said === 'failed' ? t('shareFailed') : null}
      </p>
    </fieldset>
  )
}

/** Delete, asked once more on the page: no dialog, two buttons */
export function DeleteProfile() {
  const t = useTranslations('me')
  const router = useRouter()
  const [state, setState] = React.useState<'idle' | 'asking' | 'deleting' | 'failed'>('idle')
  const ask = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (state === 'asking') ask.current?.focus()
  }, [state])

  async function confirm() {
    setState('deleting')
    const result = await deleteProfile().catch(() => ({ ok: false as const, reason: 'failed' as const }))
    if (!result.ok) return setState('failed')
    router.refresh()
  }

  if (state === 'idle' || state === 'failed') {
    return (
      <div className="flex flex-col gap-2">
        {state === 'failed' && (
          <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
            {t('deleteFailed')}
          </p>
        )}
        <Button variant="danger" onClick={() => setState('asking')} className="self-start">
          {t('deleteTitle')}
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <p ref={ask} tabIndex={-1} className="m-0 text-[14px] font-bold focus-visible:outline-none max-md:text-[15px]">
        {t('deleteAsk')}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" disabled={state === 'deleting'} onClick={confirm}>
          {state === 'deleting' ? t('deleting') : t('deleteConfirm')}
        </Button>
        <Button variant="secondary" disabled={state === 'deleting'} onClick={() => setState('idle')}>
          {t('deleteCancel')}
        </Button>
      </div>
    </div>
  )
}

/**
 * A finished test kept by email sign-in (lib/profile/device.ts): the answers waited on this device, and
 * are saved now, once. The page is read again; on failure the person is told to take the test again.
 */
export function PendingProfile() {
  const t = useTranslations('me')
  const router = useRouter()
  const [state, setState] = React.useState<'idle' | 'saving' | 'failed'>('idle')
  const started = React.useRef(false)
  React.useEffect(() => {
    if (started.current) return
    started.current = true
    const store = deviceStore()
    const pending = readPending(store, new Date())
    if (!pending) return
    setState('saving')
    void saveProfile({ test: pending.test, answers: pending.answers })
      .catch(() => ({ ok: false as const, reason: 'failed' as const }))
      .then((result) => {
        remove(store, PENDING_KEY)
        if (!result.ok) return setState('failed')
        remove(store, draftKey(pending.test))
        setState('idle')
        router.refresh()
      })
  }, [router])
  if (state === 'idle') return null
  return (
    <p role={state === 'failed' ? 'alert' : 'status'} className={cn('m-0 rounded-btn px-4 py-3 text-[14px] font-semibold max-md:text-[15px]', state === 'failed' ? 'bg-flag-bg' : 'bg-surface-soft')}>
      {state === 'saving' ? t('pendingSaving') : t('pendingFailed')}
    </p>
  )
}

type LinkLevel = 'domains' | 'facets'

/**
 * Sharing outside the person's groups (D-66): their profile as a PDF to send, or a private link to it, at the level
 * they choose. The link's token comes back once, when it is made; it is shown then, in full, to copy, and never
 * again, since only its fingerprint is kept. Afterwards the card says that a link is on, its level and its day,
 * and offers to turn it off or make a new one, which ends the old.
 */
export function ProfileOutside({
  facets,
  link,
  madeOn,
}: {
  /** whether the profile has facets: the full test does, the quick test does not */
  facets: boolean
  /** the link as Me read it; null when it could not be read */
  link: { on: boolean; level?: LinkLevel } | null
  /** the day the link was made, in words, when it is on */
  madeOn: string | null
}) {
  const t = useTranslations('me')
  const router = useRouter()
  const [level, setLevel] = React.useState<LinkLevel>(facets ? (link?.level ?? 'domains') : 'domains')
  const [made, setMade] = React.useState<string | null>(null)
  const [said, setSaid] = React.useState<'ended' | 'failed' | null>(null)
  const [busy, setBusy] = React.useState<'making' | 'ending' | null>(null)
  const id = 'outside-level'

  async function make() {
    setBusy('making')
    setSaid(null)
    const result = await makeProfileLink({ level }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setBusy(null)
    if (!result.ok) return setSaid('failed')
    setMade(`${window.location.origin}${profileLinkPath(result.token)}`)
    router.refresh()
  }

  async function end() {
    setBusy('ending')
    setSaid(null)
    const result = await endProfileLink().catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setBusy(null)
    if (!result.ok) return setSaid('failed')
    setMade(null)
    setSaid('ended')
    router.refresh()
  }

  const on = made !== null || link?.on === true
  return (
    <div className="flex flex-col gap-3">
      {facets && (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend id={`${id}-legend`} className="mb-2 text-[14px] font-bold max-md:text-[15px]">
            {t('outsideLevel')}
          </legend>
          <RadioGroup aria-labelledby={`${id}-legend`} value={level} onValueChange={(v) => (v === 'domains' || v === 'facets') && setLevel(v)} className="flex flex-col gap-2">
            {(['domains', 'facets'] as const).map((l) => (
              <RadioGroupItem
                key={l}
                value={l}
                className="group flex w-full items-start gap-3 rounded-option border-[1.5px] border-line bg-surface px-3.5 py-3 text-left data-[state=checked]:border-ink data-[state=checked]:bg-accent"
              >
                <span aria-hidden className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-[1.5px] border-line group-data-[state=checked]:border-ink">
                  <span className="hidden h-2 w-2 rounded-full bg-ink group-data-[state=checked]:block" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-semibold text-ink max-md:text-[15px]">{t(`level_${l}`)}</span>
                  <span className="text-[12.5px] text-text-2 max-md:text-[15px]">{t(`level_${l}Body`)}</span>
                </span>
              </RadioGroupItem>
            ))}
          </RadioGroup>
        </fieldset>
      )}
      <div className="flex flex-wrap gap-2">
        <a href={`${PROFILE_PDF_PATH}?level=${level}`} download className={buttonVariants({ variant: 'secondary' })}>
          {t('downloadPdf')}
        </a>
        <Button variant="secondary" disabled={busy !== null} onClick={make}>
          {busy === 'making' ? t('making') : on ? t('makeNewLink') : t('makeLink')}
        </Button>
      </div>
      {made !== null && (
        <div className="flex flex-col gap-1.5">
          <CopyLink link={made} id="profile-link" labels={{ field: t('linkField'), copy: t('linkCopy'), copied: t('linkCopied'), failed: t('linkCopyFailed') }} compact />
          <p className="m-0 text-[12.5px] font-semibold max-md:text-[15px]">{t('linkMade')}</p>
        </div>
      )}
      {made === null && link?.on && link.level && madeOn && (
        <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('linkOn', { level: t(`linkLevel_${link.level}`), date: madeOn })}</p>
      )}
      {on && (
        <Button variant="secondary" disabled={busy !== null} onClick={end} className="self-start">
          {busy === 'ending' ? t('ending') : t('endLink')}
        </Button>
      )}
      <p role="status" className="m-0 min-h-[1em] text-[12.5px] font-semibold max-md:text-[15px]">
        {said === 'ended' ? t('linkEnded') : said === 'failed' ? t('linkFailed') : null}
      </p>
      <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('linkNote')}</p>
    </div>
  )
}

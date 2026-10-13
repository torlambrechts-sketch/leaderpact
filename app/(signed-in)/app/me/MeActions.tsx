'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { deleteProfile, saveProfile, setProfileShare } from '@/lib/profile/actions'
import { PENDING_KEY, draftKey, readPending, remove } from '@/lib/profile/device'
import { deviceStore } from '@/lib/scan/draft'
import { cn } from '@/lib/cn'

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

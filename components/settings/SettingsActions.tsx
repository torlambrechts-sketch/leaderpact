'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { deleteAccount, saveNotifications, signOutEverywhere } from '@/lib/account/actions'
import { SUMMARIES, type ExportResult, type Summary } from '@/lib/account/schema'
import { EXPORT_API_PATH } from '@/lib/routes'

const field = 'h-11 w-full rounded-input border border-line bg-surface px-3 text-[14.5px] text-ink max-md:text-[16px]'
const said = 'm-0 min-h-[1em] text-[12.5px] font-semibold max-md:text-[15px]'

/** The person's time zone (0022): a native select of the zones the runtime knows, saved with the summary as it is */
export function TimeZoneForm({ summary, timeZone, zones }: { summary: Summary; timeZone: string | null; zones: string[] }) {
  const t = useTranslations('settings')
  const router = useRouter()
  const [value, setValue] = React.useState(timeZone ?? '')
  const [state, setState] = React.useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setState('saving')
    const result = await saveNotifications({ summary, timeZone: value || null }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setState(result.ok ? 'saved' : 'failed')
    if (result.ok) router.refresh()
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label htmlFor="time-zone" className="text-[14px] font-bold max-md:text-[15px]">
            {t('timeZoneLabel')}
          </label>
          <span id="time-zone-hint" className="text-[12.5px] text-text-2 max-md:text-[15px]">
            {t('timeZoneHint')}
          </span>
          <select id="time-zone" aria-describedby="time-zone-hint" value={value} onChange={(e) => (setValue(e.target.value), setState('idle'))} className={field}>
            <option value="">{t('timeZoneUnset')}</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={state === 'saving'}>
          {state === 'saving' ? t('saving') : t('save')}
        </Button>
      </div>
      <p role="status" className={said}>
        {state === 'saved' ? t('saved') : state === 'failed' ? t('saveFailed') : null}
      </p>
    </form>
  )
}

/** How often the summary arrives (handoff 6.18; 0022): weekly, monthly or never, saved with the time zone as it is */
export function SummaryForm({ summary, timeZone }: { summary: Summary; timeZone: string | null }) {
  const t = useTranslations('settings')
  const router = useRouter()
  const [value, setValue] = React.useState<Summary>(summary)
  const [state, setState] = React.useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setState('saving')
    const result = await saveNotifications({ summary: value, timeZone }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setState(result.ok ? 'saved' : 'failed')
    if (result.ok) router.refresh()
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend id="summary-legend" className="mb-2 text-[14px] font-bold max-md:text-[15px]">
          {t('summaryLabel')}
        </legend>
        <RadioGroup
          aria-labelledby="summary-legend"
          value={value}
          onValueChange={(v) => {
            const next = SUMMARIES.find((s) => s === v)
            if (next) (setValue(next), setState('idle'))
          }}
          className="flex flex-col gap-2"
        >
          {SUMMARIES.map((s) => (
            <RadioGroupItem
              key={s}
              value={s}
              className="group flex w-full items-start gap-3 rounded-option border-[1.5px] border-line bg-surface px-3.5 py-3 text-left data-[state=checked]:border-ink data-[state=checked]:bg-accent"
            >
              <span aria-hidden className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-[1.5px] border-line group-data-[state=checked]:border-ink">
                <span className="hidden h-2 w-2 rounded-full bg-ink group-data-[state=checked]:block" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[14px] font-semibold text-ink max-md:text-[15px]">{t(`summary_${s}`)}</span>
                <span className="text-[12.5px] text-text-2 max-md:text-[15px]">{t(`summary_${s}Hint`)}</span>
              </span>
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={state === 'saving'}>
          {state === 'saving' ? t('saving') : t('save')}
        </Button>
        <p role="status" className={said}>
          {state === 'saved' ? t('saved') : state === 'failed' ? t('saveFailed') : null}
        </p>
      </div>
    </form>
  )
}

/** Ends every session the person has, this one included; the action goes to the landing page when it works */
export function SignOutEverywhere() {
  const t = useTranslations('settings')
  const [state, setState] = React.useState<'idle' | 'working' | 'failed'>('idle')

  async function go() {
    setState('working')
    const result = await signOutEverywhere().catch(() => ({ ok: false as const, reason: 'failed' as const }))
    if (!result.ok) setState('failed')
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="secondary" disabled={state === 'working'} onClick={go}>
        {state === 'working' ? t('signingOut') : t('signOutEverywhere')}
      </Button>
      {state === 'failed' && (
        <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
          {t('signOutFailed')}
        </p>
      )}
    </div>
  )
}

/** Delete, asked once more on the page: no dialog, two buttons. The only leader of a group with others is told which */
export function DeleteAccount() {
  const t = useTranslations('settings')
  const [state, setState] = React.useState<{ step: 'idle' | 'asking' | 'deleting' } | { step: 'failed' } | { step: 'sole_leader'; groups: string[] }>({ step: 'idle' })
  const ask = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (state.step === 'asking') ask.current?.focus()
  }, [state.step])

  async function confirm() {
    setState({ step: 'deleting' })
    const result = await deleteAccount({ confirm: 'delete' }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    if (result.reason === 'sole_leader' && 'groups' in result) return setState({ step: 'sole_leader', groups: result.groups })
    setState({ step: 'failed' })
  }

  if (state.step === 'asking' || state.step === 'deleting') {
    return (
      <div className="flex flex-col gap-2">
        <p ref={ask} tabIndex={-1} className="m-0 text-[14px] font-bold focus-visible:outline-none max-md:text-[15px]">
          {t('deleteAsk')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" disabled={state.step === 'deleting'} onClick={confirm}>
            {state.step === 'deleting' ? t('deleting') : t('deleteConfirm')}
          </Button>
          <Button variant="secondary" disabled={state.step === 'deleting'} onClick={() => setState({ step: 'idle' })}>
            {t('deleteCancel')}
          </Button>
        </div>
      </div>
    )
  }
  const list = state.step === 'sole_leader' ? new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(state.groups) : ''
  return (
    <div className="flex flex-col items-start gap-2">
      {state.step === 'failed' && (
        <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
          {t('deleteFailed')}
        </p>
      )}
      {state.step === 'sole_leader' && (
        <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
          {t('deleteSoleLeader', { groups: list })}
        </p>
      )}
      <Button variant="danger" onClick={() => setState({ step: 'asking' })}>
        {t('deleteTitle')}
      </Button>
    </div>
  )
}

/** "Download my data": asks the export route; past 5 a day it answers 429 with the seconds to wait */
export function RequestExport({ email }: { email: string }) {
  const t = useTranslations('settings')
  const [state, setState] = React.useState<{ step: 'idle' | 'asking' | 'sent' | 'failed' } | { step: 'too_many'; minutes: number }>({ step: 'idle' })

  async function ask() {
    setState({ step: 'asking' })
    try {
      const res = await fetch(EXPORT_API_PATH, { method: 'POST', headers: { accept: 'application/json' } })
      const body = (await res.json().catch(() => null)) as ExportResult | null
      if (res.ok && body?.ok) return setState({ step: 'sent' })
      if (res.status === 429 && body && !body.ok && body.reason === 'too_many') return setState({ step: 'too_many', minutes: Math.max(1, Math.ceil(body.retry / 60)) })
      setState({ step: 'failed' })
    } catch {
      setState({ step: 'failed' })
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="secondary" disabled={state.step === 'asking' || state.step === 'sent'} onClick={ask}>
        {state.step === 'asking' ? t('exportRequesting') : t('exportRequest')}
      </Button>
      <p role="status" className={said}>
        {state.step === 'sent'
          ? t('exportSent', { email })
          : state.step === 'too_many'
            ? t('exportTooMany', { minutes: state.minutes })
            : state.step === 'failed'
              ? t('exportFailed')
              : null}
      </p>
    </div>
  )
}

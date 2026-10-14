'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { TextField } from '@/components/lp/TextField'
import { Button } from '@/components/ui/button'
import { planMeeting } from '@/lib/meetings/actions'
import { MEETING_TITLE_MAX, type MeetingReason } from '@/lib/meetings/schema'

export interface MeetingValues {
  title: string
  on: string
  at: string
  minutes: number
}

/** Today on the reader's own clock, as a date field holds it */
export function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function meetingReason(t: (key: string) => string, reason: MeetingReason) {
  return reason === 'unavailable'
    ? t('unavailable')
    : reason === 'invalid'
      ? t('invalid')
      : reason === 'no_owner'
        ? t('noOwner')
        : reason === 'no_task'
          ? t('noTask')
          : reason === 'full'
            ? t('full')
            : reason === 'not_allowed' || reason === 'not_leader'
              ? t('notAllowed')
              : t('writeFailed')
}

/**
 * A meeting's title, day, start and length (handoff 6.14), as the leader plans or changes it. The day and time
 * are the group's wall clock, as entered (D-48).
 */
export function MeetingForm({
  id,
  initial,
  submitLabel,
  busy,
  onSave,
  onCancel,
}: {
  id: string
  initial: MeetingValues
  submitLabel: string
  busy: boolean
  onSave: (v: MeetingValues) => void
  onCancel: () => void
}) {
  const t = useTranslations('meetings')
  const [title, setTitle] = React.useState(initial.title)
  const [on, setOn] = React.useState(initial.on)
  const [at, setAt] = React.useState(initial.at)
  const [minutes, setMinutes] = React.useState(String(initial.minutes))
  const [errors, setErrors] = React.useState<{ title?: string; on?: string; at?: string; minutes?: string }>({})
  React.useEffect(() => {
    document.getElementById(`${id}-title`)?.focus()
  }, [id])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const length = Number(minutes)
    const next = {
      title: title.trim() ? undefined : t('meetingTitleRequired'),
      on: /^\d{4}-\d{2}-\d{2}$/.test(on) ? undefined : t('dayRequired'),
      at: /^\d{2}:\d{2}$/.test(at) ? undefined : t('timeRequired'),
      minutes: Number.isInteger(length) && length >= 15 && length <= 480 ? undefined : t('lengthRange'),
    }
    setErrors(next)
    if (next.title || next.on || next.at || next.minutes) return
    onSave({ title: title.trim(), on, at, minutes: length })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <TextField id={`${id}-title`} label={t('meetingTitleLabel')} value={title} maxLength={MEETING_TITLE_MAX} error={errors.title} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex flex-wrap gap-3">
        <TextField
          id={`${id}-on`}
          type="date"
          label={t('dayLabel')}
          value={on}
          min={initial.on && initial.on < today() ? initial.on : today()}
          error={errors.on}
          onChange={(e) => setOn(e.target.value)}
          className="min-w-[160px] flex-1"
        />
        <TextField id={`${id}-at`} type="time" label={t('timeLabel')} value={at} error={errors.at} onChange={(e) => setAt(e.target.value)} className="min-w-[120px]" />
        <TextField
          id={`${id}-minutes`}
          type="number"
          inputMode="numeric"
          min={15}
          max={480}
          step={5}
          label={t('lengthLabel')}
          value={minutes}
          error={errors.minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="w-[140px]"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? t('working') : submitLabel}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  )
}

/** "Plan a meeting", for the leader: the form, then the new meeting's agenda */
export function PlanMeeting({ group, defaultMinutes, meetingsHref }: { group: string; defaultMinutes: number; meetingsHref: string }) {
  const t = useTranslations('meetings')
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [problem, setProblem] = React.useState<string | null>(null)

  async function save(v: MeetingValues) {
    setBusy(true)
    setProblem(null)
    const result = await planMeeting({ group, ...v }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setBusy(false)
    if (!result.ok || !result.meeting) return setProblem(meetingReason(t, result.ok ? 'failed' : result.reason))
    setOpen(false)
    router.push(`${meetingsHref}?meeting=${result.meeting}` as Route)
    router.refresh()
  }

  if (!open) {
    return (
      <Button className="gap-1.5 self-start" onClick={() => setOpen(true)}>
        <Plus aria-hidden size={16} />
        {t('plan')}
      </Button>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <h2 className="m-0 text-[16px] font-bold">{t('planTitle')}</h2>
      <MeetingForm
        id="plan-meeting"
        initial={{ title: t('defaultTitle'), on: '', at: '09:00', minutes: defaultMinutes }}
        submitLabel={t('planSave')}
        busy={busy}
        onSave={save}
        onCancel={() => setOpen(false)}
      />
      {problem && (
        <p role="alert" className="m-0 rounded-btn bg-flag-bg px-4 py-3 text-[13.5px] font-semibold max-md:text-[15px]">
          {problem}
        </p>
      )}
    </div>
  )
}


'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowRight, Plus } from 'lucide-react'
import { Avatar } from '@/components/lp/Avatar'
import { Card } from '@/components/lp/Card'
import { HintBox } from '@/components/lp/HintBox'
import { Pill } from '@/components/lp/Pill'
import { TextField } from '@/components/lp/TextField'
import { WarningAction, WarningBox } from '@/components/lp/WarningBox'
import { MeetingForm, meetingReason, type MeetingValues } from '@/components/meetings/MeetingForm'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { cancelMeeting, confirmItem, proposeItem, removeItem, updateItem, updateMeeting } from '@/lib/meetings/actions'
import { readiness, timeCheck } from '@/lib/meetings/build'
import { ITEM_TYPES, OUTCOME_MAX, TITLE_MAX, type AgendaItem, type ItemFields, type ItemType, type MeetingReason } from '@/lib/meetings/schema'

export interface ItemView extends AgendaItem {
  /** what it still needs, in words, or null when ready */
  needs: string | null
}

export interface AgendaProps {
  meeting: { id: string; title: string; when: string; values: MeetingValues; next: boolean }
  items: ItemView[]
  tasks: { id: string; title: string }[]
  members: { person: string; name: string; me: boolean }[]
  openActions: { id: string; title: string; owner: string; due: string; focus: string | null }[] | null
  leader: boolean
  canPropose: boolean
  canManage: boolean
  charterHref: string
  meetingsHref: string
}

type Result = { ok: true } | { ok: false; reason: MeetingReason }
const fail = { ok: false as const, reason: 'failed' as const }

/**
 * A meeting's agenda (handoff 6.14, design `meetings`, agenda tab): the time check, the task match and the
 * ready items out of total; each item with its type, desired outcome, owner, time box and team task. Any member
 * proposes an item. An item that names no team task in force is flagged, and stays if the leader keeps it; with
 * no team tasks the check is off and the leader is asked to define them. The next agenda lists every open action
 * (handoff 6.13). Section 11: "time check" and "task match", two names; no series, check-in or decision tabs.
 */
export function AgendaArea(props: AgendaProps) {
  const t = useTranslations('meetings')
  const router = useRouter()
  const { meeting, items, tasks, openActions, canPropose, canManage, leader } = props
  const [busy, setBusy] = React.useState(false)
  const [problem, setProblem] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<string | null>(null)
  const [proposing, setProposing] = React.useState(false)
  const [changing, setChanging] = React.useState(false)
  const [cancelling, setCancelling] = React.useState(false)
  const askRef = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (cancelling) askRef.current?.focus()
  }, [cancelling])

  async function run(action: () => Promise<Result>) {
    setBusy(true)
    setProblem(null)
    const result = await action().catch(() => fail)
    setBusy(false)
    if (!result.ok) {
      setProblem(meetingReason(t, result.reason))
      return false
    }
    router.refresh()
    return true
  }

  const time = timeCheck(items, meeting.values.minutes)
  const { ready, total } = readiness(items)
  const check = tasks.length > 0
  const flagged = items.filter((i) => i.flagged)
  const notReady = items.filter((i) => !i.ready)
  const timeState = time.state === 'over' ? t('over', { minutes: time.difference }) : time.state === 'left' ? t('left', { minutes: time.difference }) : t('fits')

  return (
    <div className="flex flex-col gap-5">
      <Card large className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 text-[20px] font-bold">{meeting.title}</h2>
              {meeting.next && <Pill tone="ink">{t('nextPill')}</Pill>}
            </div>
            <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{meeting.when}</p>
          </div>
          {canManage && !changing && !cancelling && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="compact" disabled={busy} onClick={() => setChanging(true)}>
                {t('change')}
              </Button>
              <Button variant="secondary" size="compact" disabled={busy} onClick={() => setCancelling(true)}>
                {t('cancelMeeting')}
              </Button>
            </div>
          )}
        </div>
        {changing && (
          <MeetingForm
            id="change-meeting"
            initial={meeting.values}
            submitLabel={t('changeSave')}
            busy={busy}
            onCancel={() => setChanging(false)}
            onSave={async (v) => {
              if (await run(() => updateMeeting({ meeting: meeting.id, ...v }))) setChanging(false)
            }}
          />
        )}
        {cancelling && (
          <div className="flex flex-col gap-3 rounded-option border-[1.5px] border-line-strong bg-surface-soft p-4">
            <p ref={askRef} tabIndex={-1} className="m-0 text-[14px] font-bold focus-visible:outline-none max-md:text-[15px]">
              {t('cancelAsk', { title: meeting.title })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  if (await run(() => cancelMeeting({ meeting: meeting.id }))) router.push(props.meetingsHref as Route)
                }}
              >
                {busy ? t('working') : t('cancelConfirm')}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setCancelling(false)}>
                {t('notYet')}
              </Button>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1.5 border-t border-divider pt-3 text-[13.5px] max-md:text-[15px] md:flex-row md:gap-8">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
            <h3 className="m-0 text-[13.5px] font-bold max-md:text-[15px]">{t('timeCheck')}</h3>
            <span>{t('planned', { planned: time.planned, length: time.length })}</span>
            <span className={cn('font-semibold', time.state === 'over' && 'text-danger')}>{timeState}</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
            <h3 className="m-0 text-[13.5px] font-bold max-md:text-[15px]">{t('taskMatch')}</h3>
            <span>{check ? t('unmatched', { count: flagged.length }) : t('checkOff')}</span>
          </div>
        </div>
        <span
          role="meter"
          aria-label={t('timeMeter')}
          aria-valuemin={0}
          aria-valuemax={time.length}
          aria-valuenow={Math.min(time.planned, time.length)}
          aria-valuetext={t('planned', { planned: time.planned, length: time.length })}
          className="relative h-1.5 overflow-hidden rounded-pill bg-track"
        >
          <span className="absolute inset-y-0 left-0 rounded-pill bg-accent-strong" style={{ width: `${Math.min(100, (time.planned / time.length) * 100)}%` }} />
        </span>
        <p className="m-0 text-[15px] font-bold">{t('ready', { ready, total })}</p>
        <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('readyRule')}</p>
      </Card>

      {problem && (
        <p role="alert" className="m-0 rounded-btn bg-flag-bg px-4 py-3 text-[13.5px] font-semibold max-md:text-[15px]">
          {problem}
        </p>
      )}

      <div className="grid items-start gap-5 min-[960px]:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-3">
          {items.length === 0 ? (
            <Card large>
              <p className="m-0 text-[14px] text-text-2 max-md:text-[15px]">{t('noItems')}</p>
            </Card>
          ) : (
            <ol aria-label={t('itemsLabel')} className="m-0 flex list-none flex-col gap-2.5 p-0">
              {items.map((item, i) => (
                <li
                  key={item.id}
                  className={cn(
                    'flex flex-col gap-3 rounded-card bg-surface px-4 py-3.5',
                    !item.ready ? 'border border-dashed border-ink' : item.flagged ? 'border-[1.5px] border-flag bg-flag-bg' : 'border border-white',
                  )}
                >
                  {editing === item.id ? (
                    <ItemForm
                      id={`edit-${item.id}`}
                      initial={item}
                      tasks={tasks}
                      members={props.members}
                      busy={busy}
                      submitLabel={t('saveChanges')}
                      onCancel={() => setEditing(null)}
                      onSave={async (v) => {
                        if (await run(() => updateItem({ item: item.id, ...v }))) setEditing(null)
                      }}
                    />
                  ) : (
                    <div className="flex flex-wrap items-start gap-3">
                      <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-accent text-[12.5px] font-bold text-accent-ink">
                        {i + 1}
                      </span>
                      <div className="flex min-w-[180px] flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="m-0 text-[14.5px] font-bold max-md:text-[15px]">{item.title}</h3>
                          {item.type && <Pill tone="neutral">{t(`type_${item.type}`)}</Pill>}
                          {item.closing && <Pill tone="accent">{t('closingPill')}</Pill>}
                        </div>
                        <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{item.outcome ?? t('noOutcome')}</p>
                        {item.task_title && <p className="m-0 text-[12.5px] text-text-2 max-md:text-[14px]">{t('task', { task: item.task_title })}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5 max-sm:w-full max-sm:flex-row max-sm:items-center max-sm:justify-between max-sm:pl-10">
                        <span className="flex items-center gap-2">
                          {item.owner && item.owner_name ? (
                            <>
                              <Avatar personId={item.owner} name={item.owner_name} size={26} className="text-[10.5px]" />
                              <span className="text-[13px] max-md:text-[15px]">
                                <span className="sr-only">{t('ownerWords')} </span>
                                {item.owner_current ? item.owner_name : t('formerOwner', { name: item.owner_name })}
                              </span>
                            </>
                          ) : (
                            <span className="text-[13px] text-text-2 max-md:text-[15px]">{t('ownerMissing')}</span>
                          )}
                          <span className="text-[13px] max-md:text-[15px]">{item.minutes === null ? t('noMinutes') : t('minutes', { minutes: item.minutes })}</span>
                        </span>
                        <span className="text-[12px] font-bold max-md:text-[13px]">
                          {!item.ready ? t('itemNotReady') : item.flagged ? t('itemNoTask') : item.confirmed ? t('itemKept') : t('itemReady')}
                        </span>
                      </div>
                    </div>
                  )}
                  {editing !== item.id && (item.can_edit || item.can_remove) && (
                    <div className="flex flex-wrap gap-2 pl-10">
                      {item.can_edit && (
                        <Button variant="secondary" size="compact" disabled={busy} aria-label={t('editNamed', { title: item.title })} onClick={() => setEditing(item.id)}>
                          {t('edit')}
                        </Button>
                      )}
                      {item.can_remove && (
                        <Button
                          variant="secondary"
                          size="compact"
                          disabled={busy}
                          aria-label={t('removeNamed', { title: item.title })}
                          onClick={() => run(() => removeItem({ item: item.id }))}
                        >
                          {t('remove')}
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          {canPropose && (
            <Card large className="flex flex-col gap-3">
              {proposing ? (
                <>
                  <h2 className="m-0 text-[16px] font-bold">{t('proposeTitle')}</h2>
                  <ItemForm
                    id="propose"
                    initial={null}
                    tasks={tasks}
                    members={props.members}
                    busy={busy}
                    submitLabel={t('proposeSave')}
                    onCancel={() => setProposing(false)}
                    onSave={async (v) => {
                      if (await run(() => proposeItem({ meeting: meeting.id, ...v }))) setProposing(false)
                    }}
                  />
                </>
              ) : (
                <Button variant="secondary" className="gap-1.5 self-start" disabled={busy} onClick={() => setProposing(true)}>
                  <Plus aria-hidden size={16} />
                  {t('propose')}
                </Button>
              )}
              <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('proposeNote')}</p>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {!check && (
            <HintBox title={t('checkOffTitle')}>
              {leader ? (
                <>
                  {t('checkOffLeader')}{' '}
                  <Link href={props.charterHref as Route} className="font-bold text-ink underline underline-offset-2">
                    {t('defineTasks')}
                  </Link>
                </>
              ) : (
                t('checkOffMember')
              )}
            </HintBox>
          )}
          {flagged.map((item) => (
            <WarningBox
              key={item.id}
              action={
                canManage ? (
                  <WarningAction disabled={busy} aria-label={t('keepNamed', { title: item.title })} onClick={() => run(() => confirmItem({ item: item.id }))}>
                    {t('keep')}
                  </WarningAction>
                ) : undefined
              }
            >
              {t('unmatchedItem', { title: item.title })}
            </WarningBox>
          ))}
          {notReady.length > 0 && (
            <Card large className="flex flex-col gap-2">
              <h2 className="m-0 text-[14px] font-bold">{t('notReady')}</h2>
              <ul aria-label={t('notReady')} className="m-0 flex list-none flex-col gap-1 p-0 text-[14px] max-md:text-[15px]">
                {notReady.map((item) => (
                  <li key={item.id}>{t('notReadyItem', { title: item.title, needs: item.needs ?? '' })}</li>
                ))}
              </ul>
            </Card>
          )}
          {openActions && (
            <Card large className="flex flex-col gap-2">
              <h2 className="m-0 text-[16px] font-bold">{t('openActions')}</h2>
              {openActions.length === 0 ? (
                <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('noOpenActions')}</p>
              ) : (
                <ul aria-label={t('openActions')} className="m-0 list-none p-0">
                  {openActions.map((a) => (
                    <li key={a.id} className="flex flex-col gap-0.5 border-t border-divider py-2.5 first:border-t-0">
                      <span className="text-[14px] font-semibold max-md:text-[15px]">{a.title}</span>
                      <span className="text-[12.5px] text-text-2 max-md:text-[14px]">
                        {a.focus ? t('openActionMetaFocus', { owner: a.owner, due: a.due, focus: a.focus }) : t('openActionMeta', { owner: a.owner, due: a.due })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('openActionsNote')}</p>
            </Card>
          )}
          {!meeting.next && (
            <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">
              {t('notNext')}{' '}
              <Link href={props.meetingsHref as Route} className="inline-flex items-center gap-1 font-bold text-ink underline underline-offset-2">
                {t('toNext')}
                <ArrowRight aria-hidden size={14} />
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ItemForm({
  id,
  initial,
  tasks,
  members,
  busy,
  submitLabel,
  onCancel,
  onSave,
}: {
  id: string
  initial: AgendaItem | null
  tasks: AgendaProps['tasks']
  members: AgendaProps['members']
  busy: boolean
  submitLabel: string
  onCancel: () => void
  onSave: (v: ItemFields) => void
}) {
  const t = useTranslations('meetings')
  const [title, setTitle] = React.useState(initial?.title ?? '')
  const [type, setType] = React.useState<ItemType | ''>(initial?.type ?? '')
  const [outcome, setOutcome] = React.useState(initial?.outcome ?? '')
  const [owner, setOwner] = React.useState(initial?.owner_current ? (initial.owner ?? '') : '')
  const [minutes, setMinutes] = React.useState(initial?.minutes ? String(initial.minutes) : '')
  const [task, setTask] = React.useState(initial?.task ?? '')
  const [errors, setErrors] = React.useState<{ title?: string; minutes?: string }>({})
  React.useEffect(() => {
    document.getElementById(`${id}-title`)?.focus()
  }, [id])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const length = minutes.trim() ? Number(minutes) : null
    const next = {
      title: title.trim() ? undefined : t('itemTitleRequired'),
      minutes: length === null || (Number.isInteger(length) && length >= 1 && length <= 240) ? undefined : t('minutesRange'),
    }
    setErrors(next)
    if (next.title || next.minutes) return
    onSave({ title: title.trim(), type: type || null, outcome: outcome.trim() || null, owner: owner || null, minutes: length, task: task || null })
  }

  const field = 'h-11 w-full rounded-input border border-line bg-surface px-3 text-[14.5px] text-ink'
  const label = 'text-[12.5px] font-semibold text-text-2 max-md:text-[15px]'
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <TextField id={`${id}-title`} label={t('itemTitleLabel')} value={title} maxLength={TITLE_MAX} error={errors.title} onChange={(e) => setTitle(e.target.value)} />
      <TextField id={`${id}-outcome`} label={t('outcomeLabel')} hint={t('outcomeHint')} value={outcome} maxLength={OUTCOME_MAX} onChange={(e) => setOutcome(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-type`} className={label}>
            {t('typeLabel')}
          </label>
          <select id={`${id}-type`} value={type} onChange={(e) => setType(e.target.value as ItemType | '')} className={field}>
            <option value="">{t('typePick')}</option>
            {ITEM_TYPES.map((k) => (
              <option key={k} value={k}>
                {t(`type_${k}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-owner`} className={label}>
            {t('ownerLabel')}
          </label>
          <select id={`${id}-owner`} value={owner} onChange={(e) => setOwner(e.target.value)} className={field}>
            <option value="">{t('ownerPick')}</option>
            {members.map((m) => (
              <option key={m.person} value={m.person}>
                {m.me ? t('meName', { name: m.name }) : m.name}
              </option>
            ))}
          </select>
        </div>
        <TextField
          id={`${id}-minutes`}
          type="number"
          inputMode="numeric"
          min={1}
          max={240}
          label={t('minutesLabel')}
          value={minutes}
          error={errors.minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        {tasks.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-task`} className={label}>
              {t('taskLabel')}
            </label>
            <select id={`${id}-task`} value={task} onChange={(e) => setTask(e.target.value)} className={field}>
              <option value="">{t('taskNone')}</option>
              {tasks.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
          </div>
        )}
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

'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowRight, CheckCircle2, Circle, Plus, Target } from 'lucide-react'
import { Avatar } from '@/components/lp/Avatar'
import { Card } from '@/components/lp/Card'
import { EvidenceChip } from '@/components/lp/EvidenceChip'
import { IconTile } from '@/components/lp/IconTile'
import { Pill } from '@/components/lp/Pill'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { StandingLabel, type Standing } from '@/components/lp/StandingLabel'
import { TextField } from '@/components/lp/TextField'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { addAction, closeFocusArea, makeFocusArea, setActionDone, updateAction } from '@/lib/plan/actions'
import { TITLE_MAX, type PlanReason } from '@/lib/plan/schema'

export interface ActionView {
  id: string
  title: string
  owner: string
  ownerName: string
  ownerCurrent: boolean
  /** YYYY-MM-DD, as the date field holds it */
  dueOn: string
  /** the same day in words */
  due: string
  done: boolean
  canEdit: boolean
}

export interface FocusAreaView {
  id: string
  scale: string
  name: string
  /** "Chosen from round 2", with the scale's level and agreement label in that round when it is readable */
  from: string
  href: string | null
  closed: string | null
  actions: ActionView[]
}

export interface CandidateView {
  key: string
  name: string
  level: string
  levelWords: string
  agreement: string
  standing: Standing
  standingLabel: string
  evidence: 'strong' | 'moderate' | 'other'
  evidenceLabel: string
  href: string
}

export interface PlanProps {
  group: string
  max: number
  canEdit: boolean
  canChoose: boolean
  members: { person: string; name: string; me: boolean }[]
  active: FocusAreaView[]
  closed: FocusAreaView[]
  /** the newest released round's scales to consider; null while the group has no released round */
  candidates: { round: string; number: number; scales: CandidateView[] } | null
  assessHref: string
}

const fail = { ok: false as const, reason: 'failed' as const }

/**
 * Plan (handoff 6.13, design `develop`, focus tab): at most two active focus areas, each a scale chosen from a
 * released round, with its actions. Every action has an owner and a due date; without an owner it is not
 * saved. The leader records the group's choice and closes a focus area (D-46); any member adds an action, and
 * its owner or the leader marks it done or changes it. Section 11's corrections: focus areas and actions only,
 * no initiatives, milestones or practices, no target on a survey score, and no count of actions per person.
 */
export function PlanArea(props: PlanProps) {
  const t = useTranslations('plan')
  const router = useRouter()
  const { group, max, canEdit, canChoose, active, closed, candidates } = props
  const [busy, setBusy] = React.useState(false)
  const [problem, setProblem] = React.useState<string | null>(null)
  const [closing, setClosing] = React.useState<string | null>(null)
  const askRef = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (closing) askRef.current?.focus()
  }, [closing])

  const reasonText = React.useCallback(
    (reason: PlanReason) =>
      reason === 'full'
        ? t('full', { max })
        : reason === 'already'
          ? t('already')
          : reason === 'unavailable'
            ? t('unavailable')
            : reason === 'no_owner'
              ? t('noOwner')
              : reason === 'not_owner'
                ? t('notOwner')
                : reason === 'invalid'
                  ? t('invalid')
                  : t('writeFailed'),
    [t, max],
  )

  async function run(action: () => Promise<{ ok: true } | { ok: false; reason: PlanReason }>) {
    setBusy(true)
    setProblem(null)
    const result = await action().catch(() => fail)
    setBusy(false)
    if (!result.ok) {
      setProblem(reasonText(result.reason))
      return false
    }
    router.refresh()
    return true
  }

  const full = active.length >= max
  const open = Array.from({ length: Math.max(0, max - active.length) }, (_, i) => active.length + i + 1)

  return (
    <div className="grid items-start gap-5 min-[960px]:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-4">
        {/* on the page's cream, the meta takes --text-2: --muted fails there (4.04:1) */}
        <SectionHeader title={t('focusTitle')} meta={<span className="text-text-2">{t('focusMeta', { count: active.length, max })}</span>} className="mb-0" />
        {problem && (
          <p role="alert" className="m-0 rounded-btn bg-flag-bg px-4 py-3 text-[13.5px] font-semibold max-md:text-[15px]">
            {problem}
          </p>
        )}

        {active.map((area) => (
          <FocusCard
            key={area.id}
            group={group}
            area={area}
            members={props.members}
            canEdit={canEdit}
            busy={busy}
            run={run}
            reasonText={reasonText}
            close={
              canChoose
                ? closing === area.id
                  ? (
                      <div className="flex flex-col gap-3 rounded-option border-[1.5px] border-line-strong bg-surface-soft p-4">
                        <p ref={askRef} tabIndex={-1} className="m-0 text-[14px] font-bold focus-visible:outline-none max-md:text-[15px]">
                          {t('closeAsk', { name: area.name })}
                        </p>
                        <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('closeBody')}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            disabled={busy}
                            onClick={async () => {
                              if (await run(() => closeFocusArea({ group, focusArea: area.id }))) setClosing(null)
                            }}
                          >
                            {busy ? t('working') : t('closeConfirm')}
                          </Button>
                          <Button variant="secondary" disabled={busy} onClick={() => setClosing(null)}>
                            {t('notYet')}
                          </Button>
                        </div>
                      </div>
                    )
                  : (
                      <Button
                        variant="secondary"
                        size="compact"
                        disabled={busy}
                        aria-label={t('closeNamed', { name: area.name })}
                        onClick={() => setClosing(area.id)}
                        className="self-start"
                      >
                        {t('close')}
                      </Button>
                    )
                : null
            }
          />
        ))}

        {open.map((n) => (
          <Card key={n} large className="flex flex-col gap-2 border-dashed border-line-strong">
            <h3 className="m-0 text-[15px] font-bold max-md:text-[16px]">{t('openPlace', { n })}</h3>
            <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">
              {!candidates ? t('openNoRound', { max }) : canChoose ? t('openChoose') : t('openMember')}
            </p>
            {!candidates && n === active.length + 1 && (
              <Link
                href={props.assessHref as Route}
                className="inline-flex items-center gap-1.5 self-start text-[14px] font-bold text-ink underline underline-offset-2 max-md:min-h-[44px] max-md:text-[15px]"
              >
                {t('toAssess')}
                <ArrowRight aria-hidden size={15} />
              </Link>
            )}
          </Card>
        ))}

        {candidates && !full && candidates.scales.length > 0 && (
          <Card large className="flex flex-col gap-3">
            <SectionHeader as="h2" title={t('candidatesTitle')} meta={t('candidatesMeta', { number: candidates.number })} className="mb-0" />
            <ul aria-label={t('candidatesTitle')} className="m-0 list-none p-0">
              {candidates.scales.map((s) => (
                <li key={s.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-divider py-3">
                  <div className="flex min-w-[200px] flex-1 basis-[220px] flex-col gap-1">
                    <Link href={s.href as Route} className="self-start text-[14.5px] font-bold text-ink underline-offset-2 hover:underline max-md:text-[15px]">
                      {s.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-text-2 max-md:text-[14px]">
                      <span>
                        <span className="sr-only">{s.levelWords}</span>
                        <span aria-hidden>{t('level', { level: s.level })}</span>
                      </span>
                      <span>{s.agreement}</span>
                      <StandingLabel standing={s.standing} label={s.standingLabel} />
                      <EvidenceChip rating={s.evidence} label={s.evidenceLabel} />
                    </div>
                  </div>
                  {canChoose && (
                    <Button
                      variant="secondary"
                      size="compact"
                      disabled={busy}
                      aria-label={t('makeNamed', { name: s.name })}
                      onClick={() => run(() => makeFocusArea({ group, round: candidates.round, scale: s.key }))}
                    >
                      {t('make')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {full && canChoose && <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('fullNote', { max })}</p>}

        {closed.length > 0 && (
          <>
            <h2 className="m-0 mt-2 text-[16px] font-bold">{t('closedTitle')}</h2>
            {closed.map((area) => (
              <FocusCard
                key={area.id}
                group={group}
                area={area}
                members={props.members}
                canEdit={canEdit}
                busy={busy}
                run={run}
                reasonText={reasonText}
                close={null}
              />
            ))}
          </>
        )}
      </div>

      <Card large className="flex flex-col gap-2.5">
        <h2 className="m-0 text-[16px] font-bold">{t('rulesTitle')}</h2>
        <p className="m-0 text-[13.5px] leading-[1.5] text-text-2 max-md:text-[15px]">{t('ruleFocus', { max })}</p>
        <p className="m-0 text-[13.5px] leading-[1.5] text-text-2 max-md:text-[15px]">{t('ruleOwner')}</p>
        <p className="m-0 text-[13.5px] leading-[1.5] text-text-2 max-md:text-[15px]">{t('ruleWho')}</p>
        <p className="m-0 text-[13.5px] leading-[1.5] text-text-2 max-md:text-[15px]">{t('ruleNoTarget')}</p>
        {!canEdit && <p className="m-0 border-t border-divider pt-2.5 text-[13.5px] font-semibold max-md:text-[15px]">{t('readOnly')}</p>}
      </Card>
    </div>
  )
}

function FocusCard({
  group,
  area,
  members,
  canEdit,
  busy,
  run,
  reasonText,
  close,
}: {
  group: string
  area: FocusAreaView
  members: PlanProps['members']
  canEdit: boolean
  busy: boolean
  run: (action: () => Promise<{ ok: true } | { ok: false; reason: PlanReason }>) => Promise<boolean>
  reasonText: (reason: PlanReason) => string
  close: React.ReactNode
}) {
  const t = useTranslations('plan')
  const [adding, setAdding] = React.useState(false)
  const [editing, setEditing] = React.useState<string | null>(null)
  const openCount = area.actions.filter((a) => !a.done).length
  const titleId = `focus-${area.id}`
  return (
    <section aria-labelledby={titleId}>
      <Card large className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <IconTile icon={Target} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id={titleId} className="m-0 text-[17px] font-bold">
                {area.href ? (
                  <Link href={area.href as Route} className="text-ink underline-offset-2 hover:underline">
                    {area.name}
                  </Link>
                ) : (
                  area.name
                )}
              </h3>
              {area.closed && <Pill tone="neutral">{t('closedOn', { date: area.closed })}</Pill>}
            </div>
            <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{area.from}</p>
          </div>
        </div>
        {close}
        <SectionHeader as="h4" title={t('actions')} meta={t('actionsMeta', { open: openCount, done: area.actions.length - openCount })} className="mb-0 mt-1" />
        {area.actions.length === 0 ? (
          <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('noActions')}</p>
        ) : (
          <ul aria-label={t('actionsOf', { name: area.name })} className="m-0 list-none p-0">
            {area.actions.map((action) => (
              <li key={action.id} className="flex flex-col gap-2 border-t border-divider py-3">
                {editing === action.id ? (
                  <ActionForm
                    id={`edit-${action.id}`}
                    members={members}
                    initial={action}
                    busy={busy}
                    reasonText={reasonText}
                    submitLabel={t('saveChanges')}
                    onCancel={() => setEditing(null)}
                    onSave={async (v) => {
                      const ok = await run(() => updateAction({ group, action: action.id, ...v }))
                      if (ok) setEditing(null)
                      return ok
                    }}
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    {action.canEdit ? (
                      <button
                        type="button"
                        disabled={busy}
                        aria-pressed={action.done}
                        aria-label={t('doneToggle', { title: action.title })}
                        onClick={() => run(() => setActionDone({ group, action: action.id, done: !action.done }))}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-ink hover:bg-surface-soft max-md:h-11 max-md:w-11"
                      >
                        {action.done ? <CheckCircle2 aria-hidden size={20} /> : <Circle aria-hidden size={20} className="text-muted" />}
                      </button>
                    ) : (
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center max-md:h-11 max-md:w-11">
                        {action.done ? <CheckCircle2 aria-hidden size={20} className="text-ink" /> : <Circle aria-hidden size={20} className="text-muted" />}
                      </span>
                    )}
                    <span className="sr-only">{action.done ? t('done') : t('open')}</span>
                    <span className={cn('min-w-[160px] flex-1 basis-[200px] text-[14px] max-md:text-[15px]', action.done && 'text-text-2 line-through')}>{action.title}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <Avatar personId={action.owner} name={action.ownerName} size={26} className="text-[10.5px]" />
                      <span className="text-[12.5px] max-md:text-[14px]">
                        <span className="sr-only">{t('ownerWords')} </span>
                        {action.ownerCurrent ? action.ownerName : t('formerOwner', { name: action.ownerName })}
                      </span>
                      <span className="text-[12.5px] text-text-2 max-md:text-[14px]">{t('due', { date: action.due })}</span>
                    </span>
                    {action.canEdit && !action.done && (
                      <Button variant="secondary" size="compact" disabled={busy} aria-label={t('editNamed', { title: action.title })} onClick={() => setEditing(action.id)}>
                        {t('edit')}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && !area.closed && (
          <div className="border-t border-divider pt-3">
            {adding ? (
              <ActionForm
                id={`add-${area.id}`}
                members={members}
                initial={null}
                busy={busy}
                reasonText={reasonText}
                submitLabel={t('addSave')}
                onCancel={() => setAdding(false)}
                onSave={async (v) => {
                  const ok = await run(() => addAction({ group, focusArea: area.id, ...v }))
                  if (ok) setAdding(false)
                  return ok
                }}
              />
            ) : (
              <Button variant="secondary" size="compact" className="gap-1.5" disabled={busy} onClick={() => setAdding(true)} aria-label={t('addNamed', { name: area.name })}>
                <Plus aria-hidden size={15} />
                {t('add')}
              </Button>
            )}
          </div>
        )}
      </Card>
    </section>
  )
}

/** Today on the reader's own clock, as a date field holds it */
function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ActionForm({
  id,
  members,
  initial,
  busy,
  reasonText,
  submitLabel,
  onCancel,
  onSave,
}: {
  id: string
  members: PlanProps['members']
  initial: ActionView | null
  busy: boolean
  reasonText: (reason: PlanReason) => string
  submitLabel: string
  onCancel: () => void
  onSave: (v: { title: string; owner: string; due: string }) => Promise<boolean>
}) {
  const t = useTranslations('plan')
  const [title, setTitle] = React.useState(initial?.title ?? '')
  // a former member stays named until someone else is chosen; an empty owner is never saved
  const [owner, setOwner] = React.useState(initial?.ownerCurrent ? initial.owner : '')
  const [due, setDue] = React.useState(initial?.dueOn ?? '')
  const [errors, setErrors] = React.useState<{ title?: string; owner?: string; due?: string }>({})
  React.useEffect(() => {
    document.getElementById(`${id}-title`)?.focus()
  }, [id])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = {
      title: title.trim() ? undefined : t('titleRequired'),
      owner: owner ? undefined : reasonText('no_owner'),
      due: /^\d{4}-\d{2}-\d{2}$/.test(due) ? undefined : t('dueRequired'),
    }
    setErrors(next)
    if (next.title || next.owner || next.due) return
    await onSave({ title: title.trim(), owner, due })
  }

  const field = 'h-11 rounded-input border border-line bg-surface px-3 text-[14.5px] text-ink'
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <TextField
        id={`${id}-title`}
        label={t('titleLabel')}
        value={title}
        maxLength={TITLE_MAX}
        error={errors.title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <label htmlFor={`${id}-owner`} className="text-[12.5px] font-semibold text-text-2 max-md:text-[15px]">
            {t('ownerLabel')}
          </label>
          <select
            id={`${id}-owner`}
            value={owner}
            aria-invalid={errors.owner ? true : undefined}
            aria-describedby={errors.owner ? `${id}-owner-error` : undefined}
            onChange={(e) => setOwner(e.target.value)}
            className={cn(field, errors.owner && 'border-danger')}
          >
            <option value="">{t('ownerPick')}</option>
            {members.map((m) => (
              <option key={m.person} value={m.person}>
                {m.me ? t('meName', { name: m.name }) : m.name}
              </option>
            ))}
          </select>
          {errors.owner && (
            <p id={`${id}-owner-error`} role="alert" className="m-0 text-[12.5px] font-semibold text-danger max-md:text-[15px]">
              {errors.owner}
            </p>
          )}
        </div>
        <div className="flex min-w-[160px] flex-col gap-1.5">
          <label htmlFor={`${id}-due`} className="text-[12.5px] font-semibold text-text-2 max-md:text-[15px]">
            {t('dueLabel')}
          </label>
          <input
            id={`${id}-due`}
            type="date"
            value={due}
            min={initial?.dueOn && initial.dueOn < today() ? initial.dueOn : today()}
            aria-invalid={errors.due ? true : undefined}
            aria-describedby={errors.due ? `${id}-due-error` : undefined}
            onChange={(e) => setDue(e.target.value)}
            className={cn(field, errors.due && 'border-danger')}
          />
          {errors.due && (
            <p id={`${id}-due-error`} role="alert" className="m-0 text-[12.5px] font-semibold text-danger max-md:text-[15px]">
              {errors.due}
            </p>
          )}
        </div>
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

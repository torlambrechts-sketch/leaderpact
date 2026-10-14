'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Lock, Plus, Trash2 } from 'lucide-react'
import { Card } from '@/components/lp/Card'
import { Pill } from '@/components/lp/Pill'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { Button } from '@/components/ui/button'
import { agreeDraft, discardDraft, saveDraft } from '@/lib/group/actions'
import { RIGHTS, type GroupReason, type Right } from '@/lib/group/schema'
import { cn } from '@/lib/cn'

interface Task {
  title: string
  right: Right
}
interface Content {
  purpose: string
  tasks: Task[]
  agreements: string[]
}
export interface CharterProps {
  group: string
  inForce: (Content & { version: number }) | null
  draft: (Content & { basedOn: number | null; updated: string }) | null
  versions: { version: number; agreed: string; href: string; current: boolean }[]
  earlier: (Content & { version: number; agreed: string }) | null
  limits: { maxTasks: number; maxAgreements: number; purposeLength: number; itemLength: number }
  canEdit: boolean
  leader: boolean
  currentHref: string
}

type Mode = { kind: 'view'; said?: 'saved' | 'agreed' | 'discarded'; version?: number } | { kind: 'edit' }

function TaskList({ tasks, label }: { tasks: Task[]; label: string }) {
  const t = useTranslations('group')
  return (
    <ul aria-label={label} className="m-0 list-none p-0">
      {tasks.map((task, i) => (
        <li key={`${i}-${task.title}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-divider py-3">
          <span className="min-w-0 flex-1 text-[14px] font-semibold max-md:text-[15px]">{task.title}</span>
          <Pill tone="neutral">{t(`right_${task.right}`)}</Pill>
        </li>
      ))}
    </ul>
  )
}

function Agreements({ agreements }: { agreements: string[] }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
      {agreements.map((text, i) => (
        <li key={`${i}-${text}`} className="flex items-center gap-3">
          <span aria-hidden className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-chip bg-accent text-[12px] font-bold text-accent-ink">
            {i + 1}
          </span>
          <span className="text-[14px] max-md:text-[15px]">{text}</span>
        </li>
      ))}
    </ol>
  )
}

/** The three parts of a version, as the design draws them: the purpose on the hero, then two cards */
function CharterContent({ content }: { content: Content }) {
  const t = useTranslations('group')
  return (
    <>
      <section className="flex flex-col gap-2.5 rounded-card-lg bg-hero px-6 py-6 md:px-7">
        <h2 className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-text-2 max-md:text-[13px]">{t('purpose')}</h2>
        <p className="m-0 whitespace-pre-line text-[19px] font-semibold leading-[1.45] max-md:text-[17px]">{content.purpose}</p>
      </section>
      <Card large>
        <SectionHeader title={t('tasks')} meta={t('tasksMeta', { count: content.tasks.length })} />
        <TaskList tasks={content.tasks} label={t('tasks')} />
      </Card>
      <Card large>
        <SectionHeader title={t('agreements')} />
        <Agreements agreements={content.agreements} />
      </Card>
    </>
  )
}

const field = 'w-full rounded-input border border-line bg-surface px-3.5 text-[14.5px] text-ink'

/**
 * The charter (handoff 6.8, design `group` charter tab): the version in force with its versions, the draft,
 * and the leader's editor. A draft is saved in the database and changes nothing in force until the leader
 * records that the group agrees ("The group agrees · put in force"); earlier versions open read-only. The
 * design keeps the draft in the browser; here the group can read it before it agrees (D-42).
 */
export function CharterArea(props: CharterProps) {
  const t = useTranslations('group')
  const router = useRouter()
  const { group, inForce, draft, versions, earlier, limits, canEdit, leader } = props
  const [mode, setMode] = React.useState<Mode>({ kind: 'view' })
  const status = React.useRef<HTMLParagraphElement>(null)

  React.useEffect(() => {
    if (mode.kind === 'view' && mode.said) status.current?.focus()
  }, [mode])

  if (mode.kind === 'edit') {
    const start: Content = draft ?? inForce ?? { purpose: '', tasks: [{ title: '', right: 'decide' }], agreements: [''] }
    return (
      <CharterEditor
        group={group}
        start={start}
        saved={draft !== null}
        nextVersion={(versions.at(-1)?.version ?? 0) + 1}
        limits={limits}
        onDone={(said, version) => {
          setMode({ kind: 'view', said, version })
          router.refresh()
        }}
        onCancel={() => setMode({ kind: 'view' })}
      />
    )
  }

  const said = mode.said
  const content = earlier ?? inForce
  return (
    <div className="grid items-start gap-5 min-[960px]:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        {said && (
          <p ref={status} tabIndex={-1} role="status" className="m-0 rounded-btn bg-surface-soft px-4 py-3 text-[14px] font-semibold focus-visible:outline-none max-md:text-[15px]">
            {said === 'agreed' ? t('agreedSaid', { version: mode.version ?? 0 }) : said === 'saved' ? t('savedSaid') : t('discardedSaid')}
          </p>
        )}
        {earlier && (
          <Card compact className="flex flex-wrap items-center gap-3">
            <p className="m-0 flex-1 text-[14px] font-semibold max-md:text-[15px]">{t('earlierNote', { version: earlier.version, date: earlier.agreed })}</p>
            <Link href={props.currentHref as Route} className="text-[13.5px] font-semibold underline underline-offset-2 max-md:text-[15px]">
              {t('backToCurrent')}
            </Link>
          </Card>
        )}
        {content ? (
          <CharterContent content={content} />
        ) : (
          <Card large className="flex flex-col gap-3">
            <h2 className="m-0 text-[18px] font-bold">{t('emptyTitle')}</h2>
            <p className="m-0 text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">{leader ? t('emptyLeader') : t('emptyMember')}</p>
            {canEdit && !draft && (
              <Button className="self-start" onClick={() => setMode({ kind: 'edit' })}>
                {t('start')}
              </Button>
            )}
          </Card>
        )}
        {draft && !earlier && (
          <Card large className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <Pill tone="pending">{t('draftChip')}</Pill>
              <h2 className="m-0 text-[16px] font-bold">{t('draftTitle')}</h2>
            </div>
            <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('draftBody', { date: draft.updated })}</p>
            <details className="group">
              <summary className="cursor-pointer text-[13.5px] font-semibold underline underline-offset-2 max-md:min-h-[44px] max-md:text-[15px]">
                {t('readDraft')}
              </summary>
              <div className="mt-3 flex flex-col gap-3 text-[14px] max-md:text-[15px]">
                <p className="m-0 whitespace-pre-line font-semibold">{draft.purpose || t('noPurpose')}</p>
                <TaskList tasks={draft.tasks} label={t('draftTasks')} />
                <Agreements agreements={draft.agreements} />
              </div>
            </details>
            {canEdit && (
              <Button variant="secondary" className="self-start" onClick={() => setMode({ kind: 'edit' })}>
                {t('continueDraft')}
              </Button>
            )}
          </Card>
        )}
      </div>

      <Card large className="flex flex-col gap-3">
        <Pill tone={inForce ? 'ink' : 'neutral'} className="self-start">
          {inForce ? t('inForce', { version: inForce.version }) : t('noneInForce')}
        </Pill>
        <p className="m-0 text-[13.5px] leading-[1.5] text-text-2 max-md:text-[15px]">{t('versionBody')}</p>
        {canEdit && inForce && !draft && (
          <Button onClick={() => setMode({ kind: 'edit' })}>{t('editAsDraft')}</Button>
        )}
        {!canEdit && (
          <p className="m-0 flex items-center gap-2 rounded-btn bg-surface-soft px-3.5 py-2.5 text-[13px] text-text-2 max-md:text-[15px]">
            <Lock aria-hidden size={15} className="shrink-0 text-ink" />
            {leader ? t('editPaused') : t('onlyLeaderEdits')}
          </p>
        )}
        {versions.length > 0 && (
          <nav aria-label={t('versionsLabel')} className="border-t border-divider pt-3">
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[12.5px] text-text-2 max-md:text-[15px]">
              {[...versions].reverse().map((v) => (
                <li key={v.version}>
                  <Link
                    href={v.href as Route}
                    aria-current={(earlier ? earlier.version === v.version : v.current) ? 'page' : undefined}
                    className={cn('underline-offset-2 hover:underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center', (earlier ? earlier.version === v.version : v.current) && 'font-semibold text-ink')}
                  >
                    {v.current ? t('versionCurrent', { version: v.version, date: v.agreed }) : t('versionAgreed', { version: v.version, date: v.agreed })}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </Card>
    </div>
  )
}

/**
 * The leader's draft (design `group`, editing): the purpose, the team tasks with their decision rights,
 * and the working agreements, each part within the template's limits. Blank rows are left out when saved.
 * Putting it in force asks once more, and needs all three parts.
 */
function CharterEditor({
  group,
  start,
  saved,
  nextVersion,
  limits,
  onDone,
  onCancel,
}: {
  group: string
  start: Content
  saved: boolean
  nextVersion: number
  limits: CharterProps['limits']
  onDone: (said: 'saved' | 'agreed' | 'discarded', version?: number) => void
  onCancel: () => void
}) {
  const t = useTranslations('group')
  const [purpose, setPurpose] = React.useState(start.purpose)
  const [tasks, setTasks] = React.useState<Task[]>(start.tasks.length ? start.tasks : [{ title: '', right: 'decide' }])
  const [agreements, setAgreements] = React.useState<string[]>(start.agreements.length ? start.agreements : [''])
  const [busy, setBusy] = React.useState(false)
  const [asking, setAsking] = React.useState(false)
  const [problem, setProblem] = React.useState<string | null>(null)
  const heading = React.useRef<HTMLHeadingElement>(null)
  const ask = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => heading.current?.focus(), [])
  React.useEffect(() => {
    if (asking) ask.current?.focus()
  }, [asking])

  const clean = () => ({
    group,
    purpose: purpose.trim(),
    tasks: tasks.map((x) => ({ title: x.title.trim(), right: x.right })).filter((x) => x.title !== ''),
    agreements: agreements.map((x) => x.trim()).filter((x) => x !== ''),
  })
  const say = (reason: GroupReason) =>
    setProblem(reason === 'incomplete' ? t('incomplete') : reason === 'invalid' ? t('invalidDraft') : reason === 'unavailable' ? t('editPaused') : t('writeFailed'))

  async function save(): Promise<boolean> {
    const result = await saveDraft(clean()).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    if (!result.ok) say(result.reason)
    return result.ok
  }

  async function onSave() {
    setBusy(true)
    setProblem(null)
    const ok = await save()
    setBusy(false)
    if (ok) onDone('saved')
  }

  async function onAgree() {
    const c = clean()
    if (!c.purpose || c.tasks.length === 0 || c.agreements.length === 0) {
      setAsking(false)
      return setProblem(t('incomplete'))
    }
    setBusy(true)
    setProblem(null)
    if (!(await save())) return setBusy(false)
    const result = await agreeDraft({ group }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setBusy(false)
    if (!result.ok) {
      setAsking(false)
      return say(result.reason)
    }
    onDone('agreed', result.version)
  }

  async function onDiscard() {
    setBusy(true)
    setProblem(null)
    const result = await discardDraft({ group }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setBusy(false)
    if (!result.ok) return say(result.reason)
    onDone('discarded')
  }

  return (
    <Card large className="flex flex-col gap-5 md:px-8">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Pill tone="pending">{t('draftChip')}</Pill>
          <h2 ref={heading} tabIndex={-1} className="m-0 text-[18px] font-bold focus-visible:outline-none">
            {t('editorTitle')}
          </h2>
        </div>
        <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('editorBody')}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="charter-purpose" className="text-[13px] font-bold max-md:text-[15px]">
          {t('purposeLabel')}
        </label>
        <textarea
          id="charter-purpose"
          value={purpose}
          maxLength={limits.purposeLength}
          onChange={(e) => setPurpose(e.target.value)}
          aria-describedby="charter-purpose-hint"
          className={cn(field, 'min-h-[96px] py-2.5 leading-[1.5]')}
        />
        <p id="charter-purpose-hint" className="m-0 text-[12px] text-text-2 max-md:text-[15px]">
          {t('purposeHint', { count: limits.purposeLength })}
        </p>
      </div>

      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="mb-2 text-[14px] font-bold max-md:text-[15px]">{t('tasksLegend')}</legend>
        {tasks.map((task, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2.5">
            <label htmlFor={`task-${i}`} className="sr-only">
              {t('taskLabel', { n: i + 1 })}
            </label>
            <input
              id={`task-${i}`}
              value={task.title}
              maxLength={limits.itemLength}
              placeholder={t('taskPlaceholder')}
              onChange={(e) => setTasks((list) => list.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              className={cn(field, 'h-11 min-w-0 flex-1 basis-[240px]')}
            />
            <label htmlFor={`right-${i}`} className="sr-only">
              {t('rightLabel', { n: i + 1 })}
            </label>
            <select
              id={`right-${i}`}
              value={task.right}
              onChange={(e) => setTasks((list) => list.map((x, j) => (j === i ? { ...x, right: e.target.value as Right } : x)))}
              className={cn(field, 'h-11 w-auto px-3')}
            >
              {RIGHTS.map((r) => (
                <option key={r} value={r}>
                  {t(`right_${r}`)}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="compact"
              aria-label={t('removeTask', { n: i + 1 })}
              onClick={() => setTasks((list) => list.filter((_, j) => j !== i))}
            >
              <Trash2 aria-hidden size={15} />
            </Button>
          </div>
        ))}
        {tasks.length < limits.maxTasks && (
          <Button variant="secondary" size="compact" className="gap-1.5 self-start" onClick={() => setTasks((list) => [...list, { title: '', right: 'decide' }])}>
            <Plus aria-hidden size={15} />
            {t('addTask')}
          </Button>
        )}
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="mb-2 text-[14px] font-bold max-md:text-[15px]">{t('agreements')}</legend>
        {agreements.map((text, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span aria-hidden className="w-6 shrink-0 text-[12px] font-bold text-text-2">
              {i + 1}
            </span>
            <label htmlFor={`agreement-${i}`} className="sr-only">
              {t('agreementLabel', { n: i + 1 })}
            </label>
            <input
              id={`agreement-${i}`}
              value={text}
              maxLength={limits.itemLength}
              onChange={(e) => setAgreements((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
              className={cn(field, 'h-11 min-w-0 flex-1')}
            />
            <Button variant="secondary" size="compact" aria-label={t('removeAgreement', { n: i + 1 })} onClick={() => setAgreements((list) => list.filter((_, j) => j !== i))}>
              <Trash2 aria-hidden size={15} />
            </Button>
          </div>
        ))}
        {agreements.length < limits.maxAgreements && (
          <Button variant="secondary" size="compact" className="gap-1.5 self-start" onClick={() => setAgreements((list) => [...list, ''])}>
            <Plus aria-hidden size={15} />
            {t('addAgreement')}
          </Button>
        )}
      </fieldset>

      {problem && (
        <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
          {problem}
        </p>
      )}

      {asking ? (
        <div className="flex flex-col gap-3 rounded-option border-[1.5px] border-ink bg-surface-soft p-4">
          <p ref={ask} tabIndex={-1} className="m-0 text-[14px] font-bold focus-visible:outline-none max-md:text-[15px]">
            {t('agreeAsk', { version: nextVersion })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={onAgree}>
              {busy ? t('working') : t('agreeConfirm')}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setAsking(false)}>
              {t('notYet')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-between gap-2.5 border-t border-rule-softer pt-4">
          <Button variant="secondary" disabled={busy} onClick={saved ? onDiscard : onCancel}>
            {saved ? t('discard') : t('cancel')}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={onSave}>
              {busy ? t('working') : t('saveDraft')}
            </Button>
            <Button disabled={busy} onClick={() => setAsking(true)}>
              {t('agree')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

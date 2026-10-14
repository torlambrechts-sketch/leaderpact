'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'
import { Pause, Play, Plus } from 'lucide-react'
import { Card } from '@/components/lp/Card'
import { HintBox } from '@/components/lp/HintBox'
import { Pill } from '@/components/lp/Pill'
import { TextField } from '@/components/lp/TextField'
import { WarningBox } from '@/components/lp/WarningBox'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { addItemAction, endMeeting, here, parkTopic, readLive, runMeeting, saveDecision, sendComment } from '@/lib/live/actions'
import { clock, connection, currentItem, dayWords, mmss, writable } from '@/lib/live/build'
import { COMMENT_KINDS, signalSchema, type CommentKind, type Control, type Live, type LiveReason } from '@/lib/live/schema'
import { browserClient } from '@/lib/supabase/browser'

type Result = { ok: true } | { ok: false; reason: LiveReason }
const fail = { ok: false as const, reason: 'failed' as const }
const HEARTBEAT_MS = 10_000

/** Today on the reader's own clock, as a date field holds it */
function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * The live meeting (handoff 6.15, design `live`): the current item with its type, desired outcome, team task
 * and timer; the leader's start, pause and plus 5 minutes; each item closed as reached, carried over or
 * parked. A decision and actions save per item, the parking lot holds side topics, and two process comments
 * go without a name, once enough members are online. State syncs over Supabase Realtime: a signal row changes
 * and every page reads the meeting again. If the connection drops, the page is read-only until it returns.
 * With the live_meeting flag off the meeting runs without sync.
 */
export function LiveRoom({ initial, agendaHref }: { initial: Live; agendaHref: string }) {
  const t = useTranslations('live')
  const router = useRouter()
  const [live, setLive] = React.useState(initial)
  const [offset, setOffset] = React.useState(() => Date.parse(initial.now) - Date.now())
  const [status, setStatus] = React.useState<string | null>(null)
  const [online, setOnline] = React.useState(initial.online)
  const [busy, setBusy] = React.useState(false)
  const [problem, setProblem] = React.useState<string | null>(null)
  const [heard, setHeard] = React.useState<string>('')
  const [ending, setEnding] = React.useState(false)
  const [, tick] = React.useState(0)
  const meetingId = initial.meeting.id
  const seq = React.useRef<number | null>(null)

  const refresh = React.useCallback(async () => {
    const asked = Date.now()
    const next = await readLive({ meeting: meetingId }).catch(() => null)
    if (!next) return
    // ended, here or in another browser: the page becomes its summary
    if (next.meeting.status === 'held') return router.refresh()
    setLive(next)
    setOffset(Date.parse(next.now) - Math.round((asked + Date.now()) / 2))
    setOnline(next.online)
  }, [meetingId, router])

  // Realtime: the signal row of this meeting, under its row-level security; then the meeting read again
  React.useEffect(() => {
    if (!initial.sync || initial.meeting.status !== 'live') return
    const supabase = browserClient()
    if (!supabase) {
      setStatus('CHANNEL_ERROR')
      return
    }
    let gone = false
    const channel = supabase.channel(`meeting:${meetingId}`)
    void (async () => {
      await supabase.realtime.setAuth().catch(() => undefined)
      if (gone) return
      channel
        .on('postgres_changes', { event: '*', schema: 'app', table: 'meeting_signal', filter: `meeting_id=eq.${meetingId}` }, (payload) => {
          const signal = signalSchema.safeParse(payload.new)
          if (signal.success) {
            const s = signal.data
            if (seq.current !== null && s.comment_seq > seq.current && s.comment_kind) setHeard(t('heard', { comment: t(`comment_${s.comment_kind}`) }))
            seq.current = s.comment_seq
          }
          void refresh()
        })
        .subscribe((state) => {
          setStatus(state)
          // joined again after a drop: read what was missed
          if (state === 'SUBSCRIBED') void refresh()
        })
    })()
    return () => {
      gone = true
      void supabase.removeChannel(channel)
    }
  }, [initial.sync, initial.meeting.status, meetingId, refresh, t])

  // the heartbeat: who is online decides whether process comments may be sent
  React.useEffect(() => {
    if (initial.meeting.status !== 'live') return
    const beat = async () => {
      const r = await here({ meeting: meetingId }).catch(() => null)
      if (r?.ok && typeof r.online === 'number') setOnline(r.online)
    }
    void beat()
    const id = window.setInterval(beat, HEARTBEAT_MS)
    return () => window.clearInterval(id)
  }, [initial.meeting.status, meetingId])

  // the clock
  React.useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  const conn = connection(live.sync, status)
  const canWrite = writable(conn)
  const current = currentItem(live)
  const index = current ? live.items.findIndex((i) => i.id === current.id) : -1
  const c = current ? clock(current, live.timer_started_at, Date.now() + offset) : null
  const commentsOpen = live.can_add && online >= live.k

  function say(reason: LiveReason) {
    setProblem(
      reason === 'too_few'
        ? t('tooFew', { k: live.k })
        : reason === 'no_owner'
          ? t('noOwner')
          : reason === 'unavailable'
            ? t('unavailable')
            : reason === 'full'
              ? t('full')
              : reason === 'invalid'
                ? t('invalid')
                : reason === 'not_leader'
                  ? t('notLeader')
                  : t('writeFailed'),
    )
  }

  async function run(action: () => Promise<Result>) {
    setBusy(true)
    setProblem(null)
    const result = await action().catch(() => fail)
    setBusy(false)
    if (!result.ok) {
      say(result.reason)
      return false
    }
    await refresh()
    return true
  }

  const control = (d: Control, item?: string) => run(() => runMeeting({ meeting: meetingId, do: d, item: item ?? null }))

  return (
    <div className="flex flex-col gap-5">
      <Card large className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 text-[20px] font-bold">{live.meeting.title}</h2>
            <Pill tone="ink">{t('livePill')}</Pill>
          </div>
          <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">
            <span>{t('online', { count: online })}</span>
            <span aria-hidden> · </span>
            <span>{conn === 'joined' ? t('inSync') : conn === 'joining' ? t('joining') : conn === 'off' ? t('syncOff') : t('lostShort')}</span>
          </p>
        </div>
        {conn === 'lost' && <WarningBox>{t('lost')}</WarningBox>}
        {conn === 'off' && <HintBox>{t('offBody')}</HintBox>}
      </Card>

      {problem && (
        <p role="alert" className="m-0 rounded-btn bg-flag-bg px-4 py-3 text-[13.5px] font-semibold max-md:text-[15px]">
          {problem}
        </p>
      )}
      <p role="status" aria-live="polite" className={cn('m-0 text-[14px] font-semibold max-md:text-[15px]', !heard && 'sr-only')}>
        {heard}
      </p>

      <div className="grid items-start gap-5 min-[960px]:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          {current && c ? (
            <section aria-labelledby="current-item">
              <Card large className="flex flex-col gap-3">
                <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('itemOf', { n: index + 1, total: live.items.length })}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="current-item" className="m-0 text-[22px] font-bold">
                    {current.title}
                  </h2>
                  {current.type && <Pill tone="neutral">{t(`type_${current.type}`)}</Pill>}
                </div>
                <p className="m-0 text-[14.5px] text-text-2 max-md:text-[15px]">{current.outcome ?? t('noOutcome')}</p>
                {current.task_title && <p className="m-0 text-[13px] text-text-2 max-md:text-[14px]">{t('task', { task: current.task_title })}</p>}
                {current.owner_name && <p className="m-0 text-[13px] text-text-2 max-md:text-[14px]">{t('owner', { name: current.owner_name })}</p>}
                <div className="flex flex-wrap items-end gap-4 border-t border-divider pt-3">
                  <p className="m-0 flex flex-col">
                    <span className={cn('text-big-number', c.over && 'text-danger')} aria-hidden>
                      {c.over ? `+${mmss(c.spent - c.box)}` : mmss(c.left)}
                    </span>
                    <span className="sr-only">{c.over ? t('overWords', { time: mmss(c.spent - c.box) }) : t('leftWords', { time: mmss(c.left) })}</span>
                    <span className="text-[13px] font-semibold max-md:text-[15px]">
                      {c.running ? t('running') : t('paused')} · {t('box', { minutes: Math.round(c.box / 60) })}
                    </span>
                  </p>
                  {live.can_run && (
                    <div className="flex flex-wrap gap-2">
                      <Button className="gap-1.5" disabled={busy || !canWrite} onClick={() => control(c.running ? 'pause' : 'start')}>
                        {c.running ? <Pause aria-hidden size={16} /> : <Play aria-hidden size={16} />}
                        {c.running ? t('pause') : t('start')}
                      </Button>
                      <Button variant="secondary" disabled={busy || !canWrite} onClick={() => control('extend')}>
                        {t('extend')}
                      </Button>
                    </div>
                  )}
                </div>
                {live.can_run && (
                  <div className="flex flex-col gap-2 border-t border-divider pt-3">
                    <p className="m-0 text-[13px] font-bold max-md:text-[15px]">{t('closeAs')}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="compact" disabled={busy || !canWrite} onClick={() => control('reached')}>
                        {t('reached')}
                      </Button>
                      <Button variant="secondary" size="compact" disabled={busy || !canWrite} onClick={() => control('carried_over')}>
                        {t('carryOver')}
                      </Button>
                      <Button variant="secondary" size="compact" disabled={busy || !canWrite} onClick={() => control('parked')}>
                        {t('park')}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </section>
          ) : (
            <Card large className="flex flex-col gap-2">
              <h2 className="m-0 text-[18px] font-bold">{t('allClosed')}</h2>
              <p className="m-0 text-[14px] text-text-2 max-md:text-[15px]">{live.can_run ? t('allClosedLeader') : t('allClosedMember')}</p>
            </Card>
          )}

          {current && (
            <>
              <Decision key={`d-${current.id}-${current.decision ?? ''}`} item={current.id} saved={current.decision} enabled={live.can_add && canWrite} busy={busy} run={run} />
              <ItemActions item={current.id} actions={current.actions} members={live.members} enabled={live.can_add && canWrite} busy={busy} run={run} />
              <Card large className="flex flex-col gap-3">
                <h2 className="m-0 text-[16px] font-bold">{t('commentsTitle')}</h2>
                <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('commentsNote')}</p>
                <div className="flex flex-wrap gap-2">
                  {COMMENT_KINDS.map((kind: CommentKind) => (
                    <Button
                      key={kind}
                      variant="secondary"
                      disabled={busy || !canWrite || !commentsOpen}
                      onClick={() => run(() => sendComment({ meeting: meetingId, kind }))}
                    >
                      {t(`comment_${kind}`)}
                    </Button>
                  ))}
                </div>
                {live.can_add && !commentsOpen && <p className="m-0 text-[13px] font-semibold max-md:text-[15px]">{t('commentsClosed', { k: live.k, count: online })}</p>}
                <ul aria-label={t('commentCounts')} className="m-0 flex list-none flex-col gap-1 p-0 text-[13.5px] max-md:text-[15px]">
                  {COMMENT_KINDS.map((kind) => (
                    <li key={kind}>{t('commentCount', { comment: t(`comment_${kind}`), count: current.comments[kind] })}</li>
                  ))}
                </ul>
              </Card>
            </>
          )}

          {live.can_run && (
            <Card large className="flex flex-col gap-3">
              {ending ? (
                <>
                  <p className="m-0 text-[14px] font-bold max-md:text-[15px]">{t('endAsk')}</p>
                  <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('endBody')}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={busy || !canWrite}
                      onClick={() => run(() => endMeeting({ meeting: meetingId }))}
                    >
                      {busy ? t('working') : t('endConfirm')}
                    </Button>
                    <Button variant="secondary" disabled={busy} onClick={() => setEnding(false)}>
                      {t('notYet')}
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant="secondary" className="self-start" disabled={busy || !canWrite} onClick={() => setEnding(true)}>
                  {t('end')}
                </Button>
              )}
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card large className="flex flex-col gap-2">
            <h2 className="m-0 text-[16px] font-bold">{t('agendaTitle')}</h2>
            <ol aria-label={t('agendaTitle')} className="m-0 list-none p-0">
              {live.items.map((item, i) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2 border-t border-divider py-2.5 first:border-t-0">
                  <span className="min-w-0 flex-1 text-[14px] max-md:text-[15px]">{t('numbered', { n: i + 1, title: item.title })}</span>
                  <span className="text-[12.5px] font-bold max-md:text-[13px]">
                    {item.id === live.current ? t('stateCurrent') : item.closed_as ? t(`state_${item.closed_as}`) : t('stateToCome')}
                  </span>
                  {live.can_run && !item.closed_as && item.id !== live.current && (
                    <Button variant="secondary" size="compact" disabled={busy || !canWrite} aria-label={t('takeNamed', { title: item.title })} onClick={() => control('take', item.id)}>
                      {t('take')}
                    </Button>
                  )}
                </li>
              ))}
            </ol>
            <Link href={agendaHref as Route} className="self-start text-[13px] font-semibold text-ink underline underline-offset-2 max-md:min-h-[44px] max-md:text-[15px]">
              {t('toAgenda')}
            </Link>
          </Card>
          <Parking meeting={meetingId} topics={live.parking} enabled={live.can_add && canWrite} busy={busy} run={run} />
          {live.open_actions && (
            <Card large className="flex flex-col gap-2">
              <h2 className="m-0 text-[16px] font-bold">{t('openActions')}</h2>
              {live.open_actions.length === 0 ? (
                <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('noOpenActions')}</p>
              ) : (
                <ul aria-label={t('openActions')} className="m-0 list-none p-0">
                  {live.open_actions.map((a) => (
                    <li key={a.id} className="flex flex-col gap-0.5 border-t border-divider py-2 first:border-t-0">
                      <span className="text-[14px] font-semibold max-md:text-[15px]">{a.title}</span>
                      <span className="text-[12.5px] text-text-2 max-md:text-[14px]">{t('openActionMeta', { owner: a.owner_name, due: dayWords(a.due_on) })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Decision({ item, saved, enabled, busy, run }: { item: string; saved: string | null; enabled: boolean; busy: boolean; run: (a: () => Promise<Result>) => Promise<boolean> }) {
  const t = useTranslations('live')
  const [text, setText] = React.useState(saved ?? '')
  return (
    <Card large className="flex flex-col gap-3">
      <h2 className="m-0 text-[16px] font-bold">{t('decisionTitle')}</h2>
      {enabled ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) void run(() => saveDecision({ item, text: text.trim() }))
          }}
        >
          <label htmlFor={`decision-${item}`} className="text-[12.5px] font-semibold text-text-2 max-md:text-[15px]">
            {t('decisionLabel')}
          </label>
          <textarea
            id={`decision-${item}`}
            value={text}
            maxLength={1000}
            rows={3}
            onChange={(e) => setText(e.target.value)}
            className="rounded-input border border-line bg-surface px-3.5 py-2.5 text-[14.5px] text-ink"
          />
          <Button type="submit" className="self-start" disabled={busy || !text.trim()}>
            {t('decisionSave')}
          </Button>
        </form>
      ) : (
        <p className="m-0 text-[14px] max-md:text-[15px]">{saved ?? t('noDecision')}</p>
      )}
      {enabled && saved && <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('decisionSaved')}</p>}
    </Card>
  )
}

function ItemActions({
  item,
  actions,
  members,
  enabled,
  busy,
  run,
}: {
  item: string
  actions: Live['items'][number]['actions']
  members: Live['members']
  enabled: boolean
  busy: boolean
  run: (a: () => Promise<Result>) => Promise<boolean>
}) {
  const t = useTranslations('live')
  const [title, setTitle] = React.useState('')
  const [owner, setOwner] = React.useState('')
  const [due, setDue] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const field = 'h-11 w-full rounded-input border border-line bg-surface px-3 text-[14.5px] text-ink'
  const label = 'text-[12.5px] font-semibold text-text-2 max-md:text-[15px]'
  return (
    <Card large className="flex flex-col gap-3">
      <h2 className="m-0 text-[16px] font-bold">{t('actionsTitle')}</h2>
      {actions.length === 0 ? (
        <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('noActions')}</p>
      ) : (
        <ul aria-label={t('actionsTitle')} className="m-0 list-none p-0">
          {actions.map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5 border-t border-divider py-2 first:border-t-0">
              <span className="text-[14px] font-semibold max-md:text-[15px]">{a.title}</span>
              <span className="text-[12.5px] text-text-2 max-md:text-[14px]">{t('actionMeta', { owner: a.owner_name, due: dayWords(a.due_on) })}</span>
            </li>
          ))}
        </ul>
      )}
      {enabled && (
        <form
          noValidate
          className="flex flex-col gap-3 border-t border-divider pt-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!title.trim()) return setError(t('actionTitleRequired'))
            if (!owner) return setError(t('noOwner'))
            if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return setError(t('dueRequired'))
            setError(null)
            if (await run(() => addItemAction({ item, title: title.trim(), owner, due }))) {
              setTitle('')
              setOwner('')
              setDue('')
            }
          }}
        >
          <TextField id={`action-${item}-title`} label={t('actionTitleLabel')} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`action-${item}-owner`} className={label}>
                {t('ownerLabel')}
              </label>
              <select id={`action-${item}-owner`} value={owner} onChange={(e) => setOwner(e.target.value)} className={field}>
                <option value="">{t('ownerPick')}</option>
                {members.map((m) => (
                  <option key={m.person} value={m.person}>
                    {m.me ? t('meName', { name: m.name }) : m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`action-${item}-due`} className={label}>
                {t('dueLabel')}
              </label>
              <input id={`action-${item}-due`} type="date" min={today()} value={due} onChange={(e) => setDue(e.target.value)} className={field} />
            </div>
          </div>
          {error && (
            <p role="alert" className="m-0 text-[13px] font-semibold text-danger max-md:text-[15px]">
              {error}
            </p>
          )}
          <Button type="submit" variant="secondary" className="gap-1.5 self-start" disabled={busy}>
            <Plus aria-hidden size={15} />
            {t('actionAdd')}
          </Button>
        </form>
      )}
    </Card>
  )
}

function Parking({
  meeting,
  topics,
  enabled,
  busy,
  run,
}: {
  meeting: string
  topics: Live['parking']
  enabled: boolean
  busy: boolean
  run: (a: () => Promise<Result>) => Promise<boolean>
}) {
  const t = useTranslations('live')
  const [text, setText] = React.useState('')
  return (
    <Card large className="flex flex-col gap-2">
      <h2 className="m-0 text-[16px] font-bold">{t('parkingTitle')}</h2>
      {topics.length === 0 ? (
        <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('noParking')}</p>
      ) : (
        <ul aria-label={t('parkingTitle')} className="m-0 list-none p-0">
          {topics.map((p) => (
            <li key={p.id} className="border-t border-divider py-2 text-[14px] first:border-t-0 max-md:text-[15px]">
              {p.text}
            </li>
          ))}
        </ul>
      )}
      {enabled && (
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (text.trim() && (await run(() => parkTopic({ meeting, text: text.trim() })))) setText('')
          }}
        >
          <TextField id="parking-text" label={t('parkingLabel')} value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" variant="secondary" size="compact" className="self-start" disabled={busy || !text.trim()}>
            {t('parkingAdd')}
          </Button>
        </form>
      )}
    </Card>
  )
}

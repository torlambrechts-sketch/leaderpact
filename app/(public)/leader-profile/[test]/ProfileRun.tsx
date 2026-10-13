'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'
import { ArrowRight, MailCheck } from 'lucide-react'
import { OptionRow } from '@/components/lp/OptionRow'
import { QuestionProgress } from '@/components/lp/QuestionProgress'
import { TextField } from '@/components/lp/TextField'
import { TraitBars, type TraitLabels } from '@/components/profile/TraitBars'
import { Button } from '@/components/ui/button'
import { RadioGroup } from '@/components/ui/radio-group'
import { requestSignInLink } from '@/lib/auth/actions'
import { emailSchema } from '@/lib/auth/schema'
import { saveProfile } from '@/lib/profile/actions'
import { draftKey, readDraft, remove, writeDraft, writePending } from '@/lib/profile/device'
import { band, firstUnanswered, isComplete, position, traitSums, type Answers, type BandSet, type ProfileTest } from '@/lib/profile/score'
import { deviceStore } from '@/lib/scan/draft'
import { ME_PATH, PROFILE_PATH } from '@/lib/routes'

const VALUES = [1, 2, 3, 4, 5] as const

/**
 * A Leader Profile test from first question to kept result (handoff 6.17).
 *
 * - **Answering**: one question per screen, as the scan does (design `scan`), five options from Very
 *   inaccurate to Very accurate, Back and Next. Every answer is saved on the device as it is given, so the
 *   test resumes where it was left (lib/profile/device.ts). Nothing leaves the device while answering.
 * - **The result**: computed here from the answers and the band set in force; private to the person.
 * - **Keeping it**: signed in, one button sends the answers to `save_profile`, which stores sums only. A
 *   visitor gives an email address: the answers wait on this device and are kept when the sign-in link is
 *   opened here (/app/me). Either way the draft goes once the profile is kept.
 */
export function ProfileRun({ test, bands, signedIn, replaces }: { test: ProfileTest; bands: BandSet; signedIn: boolean; replaces: boolean }) {
  const t = useTranslations('profile')
  const [answers, setAnswers] = React.useState<Answers>({})
  const [at, setAt] = React.useState(0)
  const [ready, setReady] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const heading = React.useRef<HTMLHeadingElement>(null)
  const moved = React.useRef(false)

  React.useEffect(() => {
    const draft = readDraft(deviceStore(), test, new Date())
    if (draft) {
      setAnswers({ ...draft.answers })
      setAt(draft.position)
      if (isComplete(test, draft.answers)) setDone(true)
    }
    setReady(true)
  }, [test])

  React.useEffect(() => {
    if (moved.current) heading.current?.focus()
  }, [at, done])

  const total = test.items.length
  const item = test.items[at] ?? test.items[0]!
  const value = answers[item.id]
  const last = at === total - 1

  function save(next: Answers, nextAt: number) {
    writeDraft(deviceStore(), test, { answers: next, position: nextAt }, new Date())
  }
  function choose(raw: string) {
    const v = Number(raw)
    if (!VALUES.includes(v as (typeof VALUES)[number])) return
    const next = { ...answers, [item.id]: v }
    setAnswers(next)
    save(next, at)
  }
  function go(to: number) {
    moved.current = true
    setAt(to)
    save(answers, to)
  }
  function next() {
    if (value === undefined) return
    if (!last) return go(at + 1)
    if (!isComplete(test, answers)) return go(firstUnanswered(test, answers))
    moved.current = true
    setDone(true)
  }
  function again() {
    remove(deviceStore(), draftKey(test.key))
    moved.current = true
    setAnswers({})
    setAt(0)
    setDone(false)
  }

  if (done && isComplete(test, answers)) {
    return <Result test={test} bands={bands} answers={answers} signedIn={signedIn} replaces={replaces} onAgain={again} headingRef={heading} />
  }

  const answered = at + (value !== undefined ? 1 : 0)
  return (
    <div className="mx-auto mt-6 flex max-w-questionnaire flex-col gap-[18px] px-4 md:mt-10 md:px-6">
      <QuestionProgress
        leaveHref={PROFILE_PATH}
        leaveLabel={t('flow.leave')}
        position={t('flow.position', { n: at + 1, total })}
        value={(answered / total) * 100}
        label={t('flow.progress')}
      />
      <section
        aria-busy={!ready}
        className="flex flex-col gap-[22px] rounded-card-lg border border-white bg-surface p-6 shadow-[0_30px_60px_-40px_rgba(60,50,30,.18)] md:p-9"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-pill bg-accent px-2.5 py-1 text-[12px] font-semibold text-accent-ink">{test.key === 'quick' ? t('quickTitle') : t('fullTitle')}</span>
          {test.key === 'quick' && <span className="text-[12.5px] font-semibold text-text-2 max-md:text-[15px]">{t('firstLook')}</span>}
        </div>
        <p id="ask" className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">
          {t('flow.ask')}
        </p>
        <h1
          ref={heading}
          id="question"
          tabIndex={-1}
          className="m-0 font-display text-card-headline leading-[1.25] focus-visible:outline-none max-md:text-[24px]"
          style={{ textWrap: 'pretty' }}
        >
          {item.text}
        </h1>
        <RadioGroup key={item.id} aria-labelledby="question" aria-describedby="ask" value={value === undefined ? '' : String(value)} onValueChange={choose} className="flex flex-col gap-2">
          {VALUES.map((n) => (
            <OptionRow key={n} value={String(n)} number={n} label={t(`flow.options.${n}`)} />
          ))}
        </RadioGroup>
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" size="large" disabled={at === 0} onClick={() => go(at - 1)} className="disabled:opacity-[.35]">
            {t('flow.back')}
          </Button>
          <Button size="large" disabled={value === undefined} onClick={next} className="gap-2">
            {last ? t('flow.finish') : t('flow.next')}
            <ArrowRight aria-hidden size={16} />
          </Button>
        </div>
      </section>
      <p className="m-0 text-center text-[12.5px] text-text-2 max-md:text-[15px]">{t('flow.onDevice')}</p>
    </div>
  )
}

function Result({
  test,
  bands,
  answers,
  signedIn,
  replaces,
  onAgain,
  headingRef,
}: {
  test: ProfileTest
  bands: BandSet
  answers: Answers
  signedIn: boolean
  replaces: boolean
  onAgain: () => void
  headingRef: React.RefObject<HTMLHeadingElement | null>
}) {
  const t = useTranslations('profile')
  const sums = traitSums(test, answers)
  const view = test.traits.map((tr) => {
    const s = sums[tr.key]!
    return { key: tr.key, kind: tr.kind, domain: tr.domain, name: tr.name, band: band(s.sum, s.n, bands), position: position(s.sum, s.n) }
  })
  const labels: TraitLabels = {
    bands: { lower: t('result.band_lower'), middle: t('result.band_middle'), higher: t('result.band_higher') },
    words: (name, b) => t('result.traitWords', { name, band: b }),
    bandsLabel: t('result.bandsLabel'),
    facetsOf: (domain) => t('result.facetsOf', { domain }),
  }
  return (
    <div className="mx-auto mt-6 flex max-w-[1080px] flex-col gap-5 px-4 md:mt-10 md:px-8">
      <div className="flex flex-col gap-1.5">
        <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">
          {test.key === 'quick' ? t('result.testQuick', { name: test.name, items: test.items.length }) : t('result.testFull', { name: test.name, items: test.items.length })}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="m-0 font-display text-page-title focus-visible:outline-none max-md:text-[28px]">
          {t('result.heading')}
        </h1>
      </div>
      <div className="grid items-start gap-5 min-[960px]:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex flex-col gap-4 rounded-card-lg border border-white bg-surface px-6 py-6 md:px-8">
          <h2 className="m-0 text-[18px] font-bold">{t('result.domains')}</h2>
          <TraitBars domains={view.filter((v) => v.kind === 'domain')} facets={view.filter((v) => v.kind === 'facet')} labels={labels} />
          <div className="flex flex-col gap-1 border-t border-rule-softer pt-3 text-[12.5px] leading-[1.5] text-muted max-md:text-[15px]">
            <p className="m-0">{t('result.scaleNote')}</p>
            <p className="m-0">{t('result.notGrade')}</p>
            <p className="m-0">{t('label')}</p>
          </div>
        </section>
        <div className="flex flex-col gap-4">
          {signedIn ? <KeepSignedIn test={test} answers={answers} replaces={replaces} /> : <KeepByEmail test={test} answers={answers} />}
          <Button variant="secondary" onClick={onAgain} className="self-start">
            {t('result.again')}
          </Button>
          <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('purpose')}</p>
        </div>
      </div>
    </div>
  )
}

function KeepSignedIn({ test, answers, replaces }: { test: ProfileTest; answers: Answers; replaces: boolean }) {
  const t = useTranslations('profile')
  const router = useRouter()
  const [state, setState] = React.useState<'idle' | 'keeping' | 'failed'>('idle')
  async function keep() {
    setState('keeping')
    const result = await saveProfile({ test: test.key, answers }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    if (!result.ok) return setState('failed')
    remove(deviceStore(), draftKey(test.key))
    router.push(ME_PATH as Route)
  }
  return (
    <section className="flex flex-col gap-3 rounded-card-lg bg-ink px-6 py-6 text-white">
      <h2 className="m-0 text-[18px] font-bold">{t('result.keepTitle')}</h2>
      <p className="m-0 text-[14px] leading-[1.55] text-white/90 max-md:text-[15px]">{t('result.keepBody')}</p>
      {replaces && <p className="m-0 text-[14px] font-semibold leading-[1.55] max-md:text-[15px]">{t('result.keepReplace')}</p>}
      {state === 'failed' && (
        <p role="alert" className="m-0 text-[14px] font-semibold max-md:text-[15px]">
          {t('result.failed')}
        </p>
      )}
      <Button variant="on-ink" size="large" disabled={state === 'keeping'} onClick={keep} className="self-start font-bold">
        {state === 'keeping' ? t('result.keeping') : t('result.keep')}
      </Button>
    </section>
  )
}

function KeepByEmail({ test, answers }: { test: ProfileTest; answers: Answers }) {
  const t = useTranslations('profile')
  const [email, setEmail] = React.useState('')
  const [state, setState] = React.useState<{ kind: 'form'; problem?: 'email' | 'rate_limited' | 'failed' } | { kind: 'sending' } | { kind: 'sent'; email: string }>({ kind: 'form' })
  const sent = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => {
    if (state.kind === 'sent') sent.current?.focus()
  }, [state.kind])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const address = emailSchema.safeParse(email)
    if (!address.success) return setState({ kind: 'form', problem: 'email' })
    writePending(deviceStore(), { test: test.key, version: test.id, answers }, new Date())
    setState({ kind: 'sending' })
    const result = await requestSignInLink({ email: address.data, intent: 'profile' }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    if (result.ok) return setState({ kind: 'sent', email: address.data })
    setState({ kind: 'form', problem: result.reason === 'invalid' ? 'email' : result.reason })
  }

  const card = 'on-ink flex flex-col gap-3 rounded-card-lg bg-[linear-gradient(160deg,var(--ink-raised),var(--ink))] px-6 py-6 text-white'
  if (state.kind === 'sent') {
    return (
      <section className={card}>
        <MailCheck aria-hidden size={26} />
        <h2 ref={sent} tabIndex={-1} className="m-0 text-[18px] font-bold focus-visible:outline-none">
          {t('result.sentTitle')}
        </h2>
        <p className="m-0 text-[14px] leading-[1.55] max-md:text-[15px]">{t('result.sentBody', { email: state.email })}</p>
        <Button variant="on-ink" className="self-start" onClick={() => setState({ kind: 'form' })}>
          {t('result.another')}
        </Button>
      </section>
    )
  }
  const problem = state.kind === 'form' ? state.problem : undefined
  return (
    <section aria-labelledby="keep-title" className={card}>
      <h2 id="keep-title" className="m-0 text-[18px] font-bold">
        {t('result.keepVisitorTitle')}
      </h2>
      <p className="m-0 text-[14px] leading-[1.55] text-white/90 max-md:text-[15px]">{t('result.keepVisitorBody')}</p>
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <TextField
          id="keep-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          tone="ink"
          label={t('result.emailLabel')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={problem === 'email' ? t('result.invalidEmail') : undefined}
        />
        {(problem === 'rate_limited' || problem === 'failed') && (
          <p role="alert" className="m-0 text-[13.5px] font-semibold max-md:text-[15px]">
            {t(problem === 'rate_limited' ? 'result.rateLimited' : 'result.failed')}
          </p>
        )}
        <Button type="submit" variant="on-ink" size="large" disabled={state.kind === 'sending'} className="w-full font-bold">
          {state.kind === 'sending' ? t('result.sending') : t('result.send')}
        </Button>
      </form>
    </section>
  )
}

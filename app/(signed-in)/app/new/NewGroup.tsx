'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'
import { SizeStepper } from '@/components/lp/SizeStepper'
import { TextField } from '@/components/lp/TextField'
import { Button } from '@/components/ui/button'
import { startGroup } from '@/lib/groups/actions'
import { GROUP_MAX, GROUP_MIN, groupNameSchema } from '@/lib/groups/schema'
import { forgetSave, readSave, writeReplaceKey, type PendingSave } from '@/lib/scan/device'
import { deviceStore, forget, readDraft } from '@/lib/scan/draft'
import { isComplete, type Scan } from '@/lib/scan/model'
import { submitScan } from '@/lib/scan/submit'
import { ME_PATH, SIGN_IN_PATH, homePath, invitePath } from '@/lib/routes'
import { readPending } from '@/lib/profile/device'

type Problem = 'name' | 'signed_out' | 'unavailable' | 'failed'
type State = { kind: 'deciding' } | { kind: 'working' } | { kind: 'form'; problem?: Problem }

const START_SIZE = 8

/**
 * Makes the group after sign-in (handoff 6.3). With the save card's group on this device it runs at once:
 * `start_group` makes the group and its scan, then the leader's finished scan, if it is on this device, goes
 * to that scan through `submit_scan` like any member's (owner C4), and the device keeps only its replace
 * key. Without a save, a Leader Profile kept by email goes to Me; otherwise the person's group opens at
 * Home, or the form to make one shows.
 */
export function NewGroup({ firstGroup, scan }: { firstGroup: string | null; scan: Scan | null }) {
  const t = useTranslations('newGroup')
  const ts = useTranslations('save')
  const router = useRouter()
  const [state, setState] = React.useState<State>({ kind: 'deciding' })
  const [name, setName] = React.useState('')
  const [size, setSize] = React.useState(START_SIZE)
  const started = React.useRef(false)

  const run = React.useCallback(
    async (save: PendingSave) => {
      setState({ kind: 'working' })
      const made = await startGroup(save).catch(() => ({ ok: false as const, reason: 'failed' as const }))
      if (!made.ok) {
        setName(save.name)
        setSize(save.size)
        return setState({ kind: 'form', problem: made.reason === 'invalid' ? 'name' : made.reason })
      }
      const store = deviceStore()
      forgetSave(store)

      // the leader's own answers, if they finished the scan on this device
      let answersMissing = false
      const draft = scan ? readDraft(store, scan, new Date()) : null
      if (scan && draft && isComplete(scan, draft.answers)) {
        const answers = scan.items.map((item) => ({ item: item.id, value: draft.answers[item.id] as number }))
        const sent = await submitScan({ code: made.code, answers, replaceKey: null }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
        if (sent.ok) {
          writeReplaceKey(store, made.code, sent.replaceKey)
          forget(store)
        } else {
          answersMissing = true
        }
      }
      router.replace(`${invitePath(made.team)}${answersMissing ? '?answers=missing' : ''}` as Route)
    },
    [router, scan],
  )

  React.useEffect(() => {
    if (started.current) return
    started.current = true
    const store = deviceStore()
    const now = new Date()
    const save = readSave(store, now)
    if (save) void run(save)
    // a Leader Profile kept by email sign-in: Me saves it (handoff 6.17)
    else if (readPending(store, now)) router.replace(ME_PATH as Route)
    else if (firstGroup) router.replace(homePath(firstGroup) as Route)
    else setState({ kind: 'form' })
  }, [firstGroup, router, run])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const group = groupNameSchema.safeParse(name)
    if (!group.success) return setState({ kind: 'form', problem: 'name' })
    const store = deviceStore()
    const now = new Date()
    const request = readSave(store, now)?.request ?? crypto.randomUUID()
    void run({ name: group.data, size, request })
  }

  if (state.kind === 'deciding' || state.kind === 'working') {
    return (
      <section aria-busy className="flex min-h-[200px] flex-col justify-center gap-3 rounded-card-lg border border-white bg-surface p-6 md:p-9">
        <p role="status" className="m-0 text-[15px] text-text-2">
          {state.kind === 'working' ? t('working') : null}
        </p>
      </section>
    )
  }

  const problem = state.problem
  return (
    <section className="flex flex-col gap-4 rounded-card-lg border border-white bg-surface p-6 md:p-9">
      <h1 className="m-0 font-display text-page-title max-md:text-[28px]">{t('heading')}</h1>
      <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('lead')}</p>
      {problem === 'signed_out' ? (
        <p role="alert" className="m-0 text-[14px] font-semibold text-danger max-md:text-[15px]">
          {t('signedOut')}{' '}
          <Link href={SIGN_IN_PATH as Route} className="text-link text-ink underline underline-offset-2">
            {t('signIn')}
          </Link>
        </p>
      ) : (
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <TextField
            id="group-name"
            name="group"
            autoComplete="organization"
            required
            maxLength={120}
            label={ts('nameLabel')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={problem === 'name' ? ts('invalidName') : undefined}
          />
          <SizeStepper
            id="group-size"
            label={ts('sizeLabel')}
            hint={ts('sizeHint')}
            value={size}
            min={GROUP_MIN}
            max={GROUP_MAX}
            onChange={setSize}
            fewerLabel={ts('fewer')}
            moreLabel={ts('more')}
          />
          {(problem === 'failed' || problem === 'unavailable') && (
            <p role="alert" className="m-0 text-[14px] font-semibold text-danger max-md:text-[15px]">
              {t(problem)}
            </p>
          )}
          <Button type="submit" size="large" className="self-start">
            {t('submit')}
          </Button>
        </form>
      )}
    </section>
  )
}

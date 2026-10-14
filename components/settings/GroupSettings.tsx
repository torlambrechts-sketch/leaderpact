'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { raiseThreshold, renameGroup } from '@/lib/groups/actions'
import { groupNameSchema } from '@/lib/groups/schema'

const field = 'h-11 w-full rounded-input border border-line bg-surface px-3 text-[14.5px] text-ink max-md:text-[16px]'
const said = 'm-0 min-h-[1em] text-[12.5px] font-semibold max-md:text-[15px]'

/** The leader renames the group (0026 rename_group): 1 to 120 characters, checked here and again in the database */
export function GroupNameForm({ group, name }: { group: string; name: string }) {
  const t = useTranslations('settings')
  const router = useRouter()
  const [value, setValue] = React.useState(name)
  const [state, setState] = React.useState<'idle' | 'saving' | 'saved' | 'invalid' | 'not_leader' | 'failed'>('idle')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!groupNameSchema.safeParse(value).success) return setState('invalid')
    setState('saving')
    const result = await renameGroup({ team: group, name: value }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    if (result.ok) {
      setState('saved')
      return router.refresh()
    }
    setState(result.reason === 'invalid' ? 'invalid' : result.reason === 'not_leader' ? 'not_leader' : 'failed')
  }

  const problem = state === 'invalid' ? t('groupNameInvalid') : state === 'not_leader' ? t('notLeader') : state === 'failed' ? t('saveFailed') : null
  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label htmlFor="group-name" className="text-[14px] font-bold max-md:text-[15px]">
            {t('groupNameLabel')}
          </label>
          <input
            id="group-name"
            value={value}
            maxLength={120}
            autoComplete="off"
            aria-invalid={state === 'invalid' || undefined}
            aria-describedby="group-name-said"
            onChange={(e) => (setValue(e.target.value), setState('idle'))}
            className={field}
          />
        </div>
        <Button type="submit" disabled={state === 'saving'}>
          {state === 'saving' ? t('saving') : t('save')}
        </Button>
      </div>
      <p id="group-name-said" role={problem ? 'alert' : 'status'} className={`${said} ${problem ? 'text-danger' : ''}`}>
        {problem ?? (state === 'saved' ? t('saved') : null)}
      </p>
    </form>
  )
}

/**
 * The threshold (0026 raise_threshold): 4 to 8 as answers, those at or under the current one shown and not
 * chosen, since it is never lowered. Raising is asked once more on the page, because it cannot be undone. A
 * value above the group's member count says that its results would never show.
 */
export function ThresholdForm({ group, threshold, max, members, organisation }: { group: string; threshold: number; max: number; members: number; organisation: string }) {
  const t = useTranslations('settings')
  const router = useRouter()
  const options = React.useMemo(() => Array.from({ length: max - 3 }, (_, i) => i + 4), [max])
  const [value, setValue] = React.useState(threshold)
  const [state, setState] = React.useState<'idle' | 'asking' | 'raising' | 'raised' | 'not_higher' | 'not_leader' | 'failed'>('idle')
  const ask = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (state === 'asking') ask.current?.focus()
  }, [state])

  async function confirm() {
    setState('raising')
    const result = await raiseThreshold({ team: group, threshold: value }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    if (result.ok) {
      setState('raised')
      return router.refresh()
    }
    setState(result.reason === 'not_higher' ? 'not_higher' : result.reason === 'not_leader' ? 'not_leader' : 'failed')
  }

  const problem = state === 'not_higher' ? t('thresholdNotHigher') : state === 'not_leader' ? t('notLeader') : state === 'failed' ? t('saveFailed') : null
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="sr-only">{t('thresholdLabel')}</legend>
        <RadioGroup
          aria-label={t('thresholdLabel')}
          value={String(value)}
          onValueChange={(v) => {
            const next = Number(v)
            if (options.includes(next) && next >= threshold) (setValue(next), setState('idle'))
          }}
          className="flex flex-wrap gap-2"
        >
          {options.map((n) => (
            <RadioGroupItem
              key={n}
              value={String(n)}
              disabled={n < threshold || state === 'asking' || state === 'raising'}
              className="min-h-[44px] rounded-full border-[1.5px] border-line bg-surface px-4 text-[14px] font-semibold text-ink disabled:cursor-not-allowed disabled:text-text-2 data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=checked]:text-white data-[state=checked]:disabled:text-white max-md:text-[15px]"
            >
              {t('thresholdOption', { n })}
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </fieldset>
      {value > members && (
        <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('thresholdTooFew', { members, n: value })}</p>
      )}
      {state === 'asking' || state === 'raising' ? (
        <div className="flex flex-col gap-2">
          <p ref={ask} tabIndex={-1} className="m-0 text-[14px] font-bold focus-visible:outline-none max-md:text-[15px]">
            {t('thresholdAsk', { n: value })}
          </p>
          <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('thresholdScope', { organisation })}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={state === 'raising'} onClick={confirm}>
              {state === 'raising' ? t('thresholdRaising') : t('thresholdConfirm', { n: value })}
            </Button>
            <Button variant="secondary" disabled={state === 'raising'} onClick={() => (setValue(threshold), setState('idle'))}>
              {t('thresholdCancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={value <= threshold} onClick={() => setState('asking')}>
            {t('thresholdRaise')}
          </Button>
          <p role={problem ? 'alert' : 'status'} className={`${said} ${problem ? 'text-danger' : ''}`}>
            {problem ?? (state === 'raised' ? t('thresholdRaised', { n: value }) : null)}
          </p>
        </div>
      )}
    </div>
  )
}

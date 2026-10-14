import 'server-only'
import { getTranslations } from 'next-intl/server'
import { PageTitle } from '@/components/app/AppPage'
import { Avatar } from '@/components/lp/Avatar'
import { Card } from '@/components/lp/Card'
import { Pill } from '@/components/lp/Pill'
import { WarningBox } from '@/components/lp/WarningBox'
import { SamplePage } from '@/components/sample/SamplePage'
import { sampleAvatarId, sampleWeekday } from '@/components/sample/format'
import { cn } from '@/lib/cn'
import { SAMPLE, samplePerson } from '@/lib/sample/load'

/**
 * Meetings on the Free plan (handoff 6.14 and 6.19, design `meetings`): the sample's next agenda with its
 * time check, its task match and the count of ready items. An item is ready with a type, a desired outcome,
 * an owner and a time box; an item that fits no team task is flagged and stays if the leader confirms it.
 * The agenda ends with its closing item. Section 11's corrections: "time check" and "task match", two names,
 * never "fit check"; no series, year plan, check-in, decision or audit tabs; no pre-read flags. With the
 * Team plan or its trial, the group's own meetings show instead (app/(signed-in)/app/[group]/meetings/page.tsx).
 */
export async function SampleMeetings({ group }: { group: string }) {
  const t = await getTranslations('sample')
  const { meeting, charter } = SAMPLE
  const taskTitle = (key: string | null) => charter.tasks.find((task) => task.key === key)?.title ?? null
  const planned = meeting.items.reduce((sum, item) => sum + item.minutes, 0)
  const ready = meeting.items.filter((item) => item.outcome !== null).length
  const unmatched = meeting.items.filter((item) => item.task === null)
  const notReady = meeting.items.filter((item) => item.outcome === null)
  const timeState =
    planned > meeting.minutes
      ? t('meetings.over', { minutes: planned - meeting.minutes })
      : planned < meeting.minutes
        ? t('meetings.left', { minutes: meeting.minutes - planned })
        : t('meetings.fits')

  return (
    <SamplePage group={group}>
      <PageTitle eyebrow={t('meetings.when', { day: sampleWeekday(meeting.on), time: meeting.at })} title={meeting.title} />

      <Card large className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 text-[13.5px] max-md:text-[15px] md:flex-row md:gap-8">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
            <h2 className="m-0 text-[13.5px] font-bold max-md:text-[15px]">{t('meetings.timeCheck')}</h2>
            <span>{t('meetings.planned', { planned, length: meeting.minutes })}</span>
            <span className={cn('font-semibold', planned > meeting.minutes && 'text-danger')}>{timeState}</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
            <h2 className="m-0 text-[13.5px] font-bold max-md:text-[15px]">{t('meetings.taskMatch')}</h2>
            <span>{t('meetings.unmatched', { count: unmatched.length })}</span>
          </div>
        </div>
        <span
          role="meter"
          aria-label={t('meetings.timeLabel')}
          aria-valuemin={0}
          aria-valuemax={meeting.minutes}
          aria-valuenow={planned}
          aria-valuetext={t('meetings.planned', { planned, length: meeting.minutes })}
          className="relative h-1.5 overflow-hidden rounded-pill bg-track"
        >
          <span className="absolute inset-y-0 left-0 rounded-pill bg-accent-strong" style={{ width: `${Math.min(100, (planned / meeting.minutes) * 100)}%` }} />
        </span>
      </Card>

      <Card large className="grid items-center gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 text-[20px] font-bold">{t('meetings.ready', { ready, total: meeting.items.length })}</h2>
          <p className="m-0 text-[12.5px] text-muted max-md:text-[15px]">{t('meetings.readyRule', { minutes: planned })}</p>
        </div>
        <span
          role="meter"
          aria-label={t('meetings.readyLabel')}
          aria-valuemin={0}
          aria-valuemax={meeting.items.length}
          aria-valuenow={ready}
          aria-valuetext={t('meetings.ready', { ready, total: meeting.items.length })}
          className="relative h-2 overflow-hidden rounded-pill bg-track"
        >
          <span className="absolute inset-y-0 left-0 rounded-pill bg-ink" style={{ width: `${(ready / meeting.items.length) * 100}%` }} />
        </span>
      </Card>

      <div className="grid items-start gap-5 min-[960px]:grid-cols-[minmax(0,1fr)_440px]">
        <ol aria-label={t('meetings.itemsLabel')} className="m-0 flex list-none flex-col gap-2.5 p-0">
          {meeting.items.map((item, i) => {
            const owner = samplePerson(item.owner)
            const task = taskTitle(item.task)
            const status = item.outcome === null ? t('meetings.itemNoOutcome') : item.task === null ? t('meetings.itemNoTask') : t('meetings.itemReady')
            return (
              <li
                key={item.title}
                className={cn(
                  'flex flex-wrap items-start gap-3 rounded-card bg-surface px-4 py-3.5',
                  item.outcome === null ? 'border border-dashed border-ink' : item.task === null ? 'border-[1.5px] border-flag bg-flag-bg' : 'border border-white',
                )}
              >
                <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-accent text-[12.5px] font-bold text-accent-ink">
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="m-0 text-[14.5px] font-bold max-md:text-[15px]">{item.title}</h3>
                    <Pill tone="neutral">{t(`meetings.type_${item.type}`)}</Pill>
                  </div>
                  <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{item.outcome ?? t('meetings.noOutcome')}</p>
                  {task && <p className="m-0 text-[12px] text-muted max-md:text-[14px]">{t('meetings.task', { task })}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5 max-sm:w-full max-sm:flex-row max-sm:items-center max-sm:justify-between max-sm:pl-10">
                  <span className="flex items-center gap-2">
                    <Avatar personId={sampleAvatarId(owner.key)} name={owner.name} size={26} className="text-[10.5px]" />
                    <span className="sr-only">{t('meetings.ownerWords', { name: owner.name })}</span>
                    <span className="text-[13px] max-md:text-[15px]">{t('meetings.minutes', { minutes: item.minutes })}</span>
                  </span>
                  <span className="text-[12px] font-bold max-md:text-[13px]">{status}</span>
                </div>
              </li>
            )
          })}
        </ol>

        <div className="flex flex-col gap-3">
          {notReady.length > 0 && (
            <Card large className="flex flex-col gap-2">
              <h2 className="m-0 text-[14px] font-bold">{t('meetings.notReady')}</h2>
              <ul className="m-0 list-none p-0 text-[14px] max-md:text-[15px]">
                {notReady.map((item) => (
                  <li key={item.title}>{t('meetings.notReadyItem', { title: item.title })}</li>
                ))}
              </ul>
            </Card>
          )}
          {unmatched.map((item) => (
            <WarningBox key={item.title}>{t('meetings.unmatchedItem', { title: item.title })}</WarningBox>
          ))}
        </div>
      </div>

      <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('meetings.live')}</p>
    </SamplePage>
  )
}

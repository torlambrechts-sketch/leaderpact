'use client'
import * as React from 'react'
import { HeroBlock } from '@/components/lp/HeroBlock'
import { dateFormat } from '@/lib/i18n/dates'

/**
 * Home's greeting block (handoff 6.7, design `home`) on the reader's own clock: the date and "Good morning"
 * are the device's, which the server does not know, so the server renders a plain greeting and the
 * browser puts in its own once it runs. No name: until a person sets one, the stored name is the start of
 * their email address (0009), and "Good morning, kari.nordmann." reads as a mistake (D-30).
 */
export function HomeHero({
  labels,
  status,
}: {
  labels: { morning: string; afternoon: string; evening: string; any: string }
  status: string
}) {
  const minute = React.useSyncExternalStore(subscribe, nowMinute, () => null)
  if (minute === null) return <HeroBlock date="" greeting={labels.any} status={status} />
  const at = new Date(minute * 60_000)
  const hour = at.getHours()
  const greeting = hour < 5 ? labels.evening : hour < 12 ? labels.morning : hour < 18 ? labels.afternoon : labels.evening
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const date = dateFormat({ locale: 'en', timeZone }, { weekday: 'long', day: 'numeric', month: 'long' }).format(at)
  return <HeroBlock date={date} greeting={greeting} status={status} />
}

// the clock to the minute: a stable snapshot between ticks
const nowMinute = () => Math.floor(Date.now() / 60_000)

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 30_000)
  return () => window.clearInterval(id)
}

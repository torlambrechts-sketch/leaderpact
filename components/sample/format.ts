import { dateFormat } from '@/lib/i18n/dates'

/**
 * The sample's dates, as the product writes them (British English). They are calendar days and months,
 * not moments, so they are read and written on UTC and never move with the reader's clock.
 */
const utc = { locale: 'en', timeZone: 'UTC' }

/** "20 Mar 2026" */
export const sampleDay = (iso: string) => dateFormat(utc, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${iso}T00:00:00Z`))

/** "Thu 8 Oct" */
export const sampleWeekday = (iso: string) => dateFormat(utc, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00Z`))

/** "Jan 2024", from "2024-01" */
export const sampleMonth = (yearMonth: string) => dateFormat(utc, { month: 'short', year: 'numeric' }).format(new Date(`${yearMonth}-01T00:00:00Z`))

/** A sample person's avatar key: stable, and never a real person's id */
export const sampleAvatarId = (key: string) => `sample-${key}`

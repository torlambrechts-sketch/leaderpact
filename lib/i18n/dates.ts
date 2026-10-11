// Origin: Orgpuls lib/i18n/dates.ts @ 6f5d441 (adapted: English only, the person's own clock).
/**
 * How the product writes a date and a time: British English, on the reader's own clock.
 *
 * `Intl` gives a bare `en` the American forms («September 14, 2026», «02:00 AM»). The catalogue is
 * British English, so its dates are too: «14 September 2026», «02:00».
 */

/** The tag `Intl` formats dates in: British English */
export const intlLocale = (_locale: string): string => 'en-GB'

/** A day as YYYY-MM-DD on a clock: what a date column holds, for comparing with one */
export const isoDay = (timeZone: string, at: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(at)

/** The reader's form and clock, as a screen passes them on */
export type Dates = { locale: string; timeZone: string }

/** A formatter in a reader's form, on a clock */
export const dateFormat = (dates: Dates, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(intlLocale(dates.locale), { timeZone: dates.timeZone, ...options })

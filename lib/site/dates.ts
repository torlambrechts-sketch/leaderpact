/** A day as the public site writes it: "13 October 2026" (British English, handoff section 3) */
export function formatDay(day: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day.slice(0, 10)}T12:00:00Z`))
}

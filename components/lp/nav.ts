import { CalendarDays, ChartColumn, ClipboardCheck, House, ListChecks, MoreHorizontal, User, UserRound, Users, type LucideIcon } from 'lucide-react'

/**
 * The app's navigation, in the order of handoff section 5: Home, Group, People, Assess, Results, Plan,
 * Meetings, Me. Settings sits behind the gear. On a phone the bottom bar carries Home, Group, Meetings,
 * Plan and More (handoff section 4). Labels come from messages (`nav.<key>`).
 */
export type NavKey = 'home' | 'group' | 'people' | 'assess' | 'results' | 'plan' | 'meetings' | 'me'

export const NAV: { key: NavKey; icon: LucideIcon; segment: string }[] = [
  { key: 'home', icon: House, segment: 'home' },
  { key: 'group', icon: Users, segment: 'group' },
  { key: 'people', icon: UserRound, segment: 'people' },
  { key: 'assess', icon: ClipboardCheck, segment: 'assess' },
  { key: 'results', icon: ChartColumn, segment: 'results' },
  { key: 'plan', icon: ListChecks, segment: 'plan' },
  { key: 'meetings', icon: CalendarDays, segment: 'meetings' },
  { key: 'me', icon: User, segment: 'me' },
]

export const PHONE_BAR: NavKey[] = ['home', 'group', 'meetings', 'plan']
export const MoreIcon = MoreHorizontal

/** /app/[group]/<segment>, except Me, which is not per group (handoff section 5). */
export function navHref(groupSlug: string, key: NavKey): string {
  return key === 'me' ? '/app/me' : `/app/${groupSlug}/${NAV.find((n) => n.key === key)!.segment}`
}

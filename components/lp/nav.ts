import { CalendarCheck, CalendarClock, Contact, House, Kanban, MoreHorizontal, TrendingUp, User, Users, type LucideIcon } from 'lucide-react'

/**
 * The app's navigation, in the order of handoff section 5: Home, Group, People, Assess, Results, Plan,
 * Meetings, Me. Settings sits behind the gear. Icons as the design draws them (spec, nav-item). On a phone the bottom bar carries Home, Group, Meetings,
 * Plan and More (handoff section 4). Labels come from messages (`nav.<key>`).
 */
export type NavKey = 'home' | 'group' | 'people' | 'assess' | 'results' | 'plan' | 'meetings' | 'me'

export const NAV: { key: NavKey; icon: LucideIcon; segment: string }[] = [
  { key: 'home', icon: House, segment: 'home' },
  { key: 'group', icon: Users, segment: 'group' },
  { key: 'people', icon: Contact, segment: 'people' },
  { key: 'assess', icon: CalendarCheck, segment: 'assess' },
  { key: 'results', icon: TrendingUp, segment: 'results' },
  { key: 'plan', icon: Kanban, segment: 'plan' },
  { key: 'meetings', icon: CalendarClock, segment: 'meetings' },
  { key: 'me', icon: User, segment: 'me' },
]

export const PHONE_BAR: NavKey[] = ['home', 'group', 'meetings', 'plan']
export const MoreIcon = MoreHorizontal

/** /app/[group]/<segment>, except Me, which is not per group (handoff section 5). */
export function navHref(groupSlug: string, key: NavKey): string {
  return key === 'me' ? '/app/me' : `/app/${groupSlug}/${NAV.find((n) => n.key === key)!.segment}`
}

// The types of scripts/seed/fixture.mjs, so the flows import its constants under `strict`.
interface Person { id: string; name: string; email: string; role: 'leader' | 'member' }
interface Group { org: { id: string; name: string }; group: { id: string; name: string }; scan: { id: string; code: string; size: number } }
export declare const FIXTURE_PASSWORD: string
export declare const LUMIO: Group & { people: Person[] }
export declare const FLOW_LEADER: { id: string; name: string; email: string }
export declare const E2E_GROUPS: (Group & { project: string })[]
export declare function render(options?: { e2e?: boolean; shots?: boolean; liveOff?: boolean }): string
/** true for a database on 127.0.0.1 or localhost: the only place the fixture writes */
export declare function localOnly(url: string): boolean
export declare const TEAM_VIEW_ANSWERS: number[][]
export declare const TEAM_VIEW_FIGURES: { theme: string; level: string; agreement: 'high' | 'medium' | 'low' }[]
export declare const TEAM_STATES: Record<'released' | 'extended' | 'closed', Group>
export declare const BILLING: Group & { leader: { id: string; name: string; email: string }; member: { id: string; name: string; email: string } }
export declare const GROUP_FLOW: Group & {
  leader: { id: string; name: string; email: string }
  member: { id: string; name: string; email: string }
  invitee: { id: string; name: string; email: string }
}
interface RoundPerson { id: string; name: string; email: string; role: 'leader' | 'member' }
export declare const ROUND_FLOW: Group & { leader: RoundPerson; member: RoundPerson; people: RoundPerson[] }
export declare const ROUND_STATES: Group & { rounds: Record<'released' | 'again' | 'closed' | 'answering', string>; people: RoundPerson[] }
export declare const PLAN_FLOW: Group & { rounds: Record<'released', string>; tasks: string[]; leader: RoundPerson; member: RoundPerson; people: RoundPerson[] }
export declare const LIVE_FLOW: Group & { meeting: { title: string; items: string[] }; leader: RoundPerson; people: RoundPerson[] }
export declare const SYNC_FLOW: Group & { meeting: { title: string; items: string[] }; leader: RoundPerson; people: RoundPerson[] }
interface PulseGroup extends Group {
  rounds: Record<'released', string>
  focus: string[]
  agreements: string[]
  leader: RoundPerson
  member: RoundPerson
  people: RoundPerson[]
}
export declare const PULSE_FLOW: PulseGroup
export declare const PULSE_STATES: PulseGroup
export declare const NO_GROUP: { id: string; name: string; email: string }
export declare const SHOTS: Group & {
  round: string
  released: string
  people: Person[]
  answered: number[]
  sales: { group: { id: string; name: string }; scan: { id: string; code: string; size: number }; people: Person[]; answers: number }
}

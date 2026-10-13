// The types of scripts/seed/fixture.mjs, so the flows import its constants under `strict`.
interface Person { id: string; name: string; email: string; role: 'leader' | 'member' }
interface Group { org: { id: string; name: string }; group: { id: string; name: string }; scan: { id: string; code: string; size: number } }
export declare const FIXTURE_PASSWORD: string
export declare const LUMIO: Group & { people: Person[] }
export declare const FLOW_LEADER: { id: string; name: string; email: string }
export declare const E2E_GROUPS: (Group & { project: string })[]
export declare function render(options?: { e2e?: boolean }): string
/** true for a database on 127.0.0.1 or localhost: the only place the fixture writes */
export declare function localOnly(url: string): boolean
export declare const TEAM_VIEW_ANSWERS: number[][]
export declare const TEAM_VIEW_FIGURES: { theme: string; level: string; agreement: 'high' | 'medium' | 'low' }[]
export declare const TEAM_STATES: Record<'released' | 'extended' | 'closed', Group>

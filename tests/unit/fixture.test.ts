import { describe, expect, it } from 'vitest'
import { E2E_GROUPS, FLOW_LEADER, LUMIO, TEAM_STATES, localOnly, render } from '../../scripts/seed/fixture.mjs'

/**
 * The fixture (CLAUDE.md, The fixture): Lumio AS with the Lumio leadership group of 8 led by Kari Nordmann,
 * deterministic, and written to local databases only.
 */
describe('the fixture', () => {
  it('is Lumio AS, the Lumio leadership group of 8, led by Kari Nordmann', () => {
    expect(LUMIO.org.name).toBe('Lumio AS')
    expect(LUMIO.group.name).toBe('Lumio leadership group')
    expect(LUMIO.people).toHaveLength(8)
    expect(LUMIO.people.filter((p) => p.role === 'leader').map((p) => p.name)).toEqual(['Kari Nordmann'])
    expect(LUMIO.scan.size).toBe(8)
  })

  it('uses addresses that cannot receive mail, and codes the scan accepts', () => {
    for (const p of [...LUMIO.people, FLOW_LEADER]) expect(p.email).toMatch(/@lumio\.example$/)
    const all = [LUMIO, ...E2E_GROUPS, ...Object.values(TEAM_STATES)]
    for (const g of all) expect(g.scan.code).toMatch(/^[A-Za-z0-9_-]{22,64}$/)
    expect(new Set(all.map((g) => g.scan.code)).size).toBe(all.length)
    expect(new Set(all.map((g) => g.group.id)).size).toBe(all.length)
  })

  it('is deterministic, and writes the leader\'s answers through submit_scan', () => {
    expect(render({ e2e: true })).toBe(render({ e2e: true }))
    expect(render()).toContain('app.submit_scan(')
    expect(render()).not.toContain('insert into app.scan_response')
    // the three states: answers through submit_scan, deadlines through close_scan, and nothing else
    expect(render({ e2e: true })).toContain('app.close_scan(')
    expect(render({ e2e: true })).not.toMatch(/insert into app\.(scan_response|scan_theme_score)|update app\.scan_session set (phase|answered|extended)/)
  })

  it('writes to 127.0.0.1 or localhost only', () => {
    expect(localOnly('postgresql://postgres@127.0.0.1:54399/postgres')).toBe(true)
    expect(localOnly('postgresql://postgres:postgres@localhost:54322/postgres')).toBe(true)
    expect(localOnly('postgresql://postgres@db.tgxjbshdjwoemsmrtkzw.supabase.co:5432/postgres')).toBe(false)
    expect(localOnly('not a url')).toBe(false)
  })
})

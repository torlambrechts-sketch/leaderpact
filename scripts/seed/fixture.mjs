/**
 * The fixture: the only source of fixture rows (CLAUDE.md, The fixture; handoff 9; REUSE 4.12). Local
 * databases only.
 *
 *   node scripts/seed/fixture.mjs                     # DATABASE_URL, or the local Supabase stack
 *   node scripts/seed/fixture.mjs --db <url> --e2e    # also the flows' own groups (tests/e2e)
 *
 * 1. **Lumio AS**, the demo organisation, with the Lumio leadership group of 8 led by Kari Nordmann, its
 *    members named as the design names them (and as data/sample/lumio.v1.json does). Every name is
 *    invented, and every address is on `lumio.example`, a name that cannot receive mail.
 * 2. **Its Leadership Team Scan is open**, with one answer: Kari's, written through `app.submit_scan`, the
 *    write path itself, so the rows have exactly the shape a submission gives (REUSE 4.12). Every answer is
 *    3, the design's personal view. Milestone 5 solves the answers backwards from the design's figures.
 * 3. **The flows' groups** (`--e2e`): one per Playwright project, each with an open scan of 10 and no
 *    answer, so the projects never share a cap; and the flow leader, an account the leader's flow signs in
 *    as where there is no Auth to send a link (D-27).
 * 4. **The team view's three states** (`--e2e`, handoff 6.6), each a group the flow leader leads: one
 *    released, from four answer sets chosen so every agreement label appears (TEAM_VIEW_FIGURES); one
 *    extended once, three answers at its first deadline; one closed with no team view, three answers at
 *    its second. Answers go through `submit_scan`, and the deadlines through `close_scan`; only the
 *    closing date is moved back, with the session's guard off for that one statement, as the suites do,
 *    because time does not pass inside a script.
 * 5. **Deterministic, and local only.** Fixed ids, link codes and a known password, so a reset gives the
 *    same rows and a test can name them. That is why the script refuses any database that is not on
 *    127.0.0.1 or localhost (REUSE 4.12: Orgpuls's fixture did not, and its tokens are derivable).
 * 6. **Idempotent.** It removes its own rows first, by their fixed ids, in one transaction.
 *
 * Kari's id is chosen so her avatar takes the first pair, as the design draws her (D-12).
 */
import { execFileSync } from 'node:child_process'
import { basename } from 'node:path'

export const FIXTURE_PASSWORD = 'lumio-local-only'

const id = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`

export const LUMIO = {
  org: { id: id('0a000000', 1), name: 'Lumio AS' },
  group: { id: id('0b000000', 1), name: 'Lumio leadership group' },
  scan: { id: id('0c000000', 1), code: 'lumioLeadershipScan00001', size: 8 },
  people: [
    { id: id('4c0e0000', 5), name: 'Kari Nordmann', email: 'kari.nordmann@lumio.example', role: 'leader' },
    { id: id('4c0e0000', 11), name: 'Ola Hansen', email: 'ola.hansen@lumio.example', role: 'member' },
    { id: id('4c0e0000', 12), name: 'Ingrid Berg', email: 'ingrid.berg@lumio.example', role: 'member' },
    { id: id('4c0e0000', 13), name: 'Lars Johansen', email: 'lars.johansen@lumio.example', role: 'member' },
    { id: id('4c0e0000', 14), name: 'Sofie Lie', email: 'sofie.lie@lumio.example', role: 'member' },
    { id: id('4c0e0000', 15), name: 'Erik Dahl', email: 'erik.dahl@lumio.example', role: 'member' },
    { id: id('4c0e0000', 16), name: 'Maja Strand', email: 'maja.strand@lumio.example', role: 'member' },
    { id: id('4c0e0000', 17), name: 'Henrik Bakke', email: 'henrik.bakke@lumio.example', role: 'member' },
  ],
}

/** An account with no group, for the leader's flow in a session without Auth (tests/e2e/leader.spec.ts) */
export const FLOW_LEADER = { id: id('4c0e0000', 901), name: 'Flow leader', email: 'flow.leader@lumio.example' }

/** The flows' groups, one per Playwright project (playwright.config.ts), each with its own open scan */
export const E2E_GROUPS = ['desktop', 'phone-390', 'phone-360'].map((project, i) => ({
  project,
  org: { id: id('0a000000', 101 + i), name: `Flow group ${i + 1}` },
  group: { id: id('0b000000', 101 + i), name: `Flow group ${i + 1}` },
  scan: { id: id('0c000000', 101 + i), code: `flowScanCode${project.replace(/[^a-z0-9]/g, '')}0000001`.slice(0, 32), size: 10 },
}))

/**
 * The released group's four answer sets, in the scan's item order (two items per theme, Appendix C), and
 * what close_scan makes of them: the level per theme, half up to one decimal, and the agreement label of
 * D-17 (high above 0.70, low at or below 0.50, on the sample variance of each person's theme mean).
 */
export const TEAM_VIEW_ANSWERS = [
  [5, 4, 1, 1, 3, 3, 2, 2, 4, 4, 5, 5],
  [5, 4, 5, 5, 3, 4, 2, 3, 2, 2, 4, 4],
  [5, 4, 1, 1, 4, 3, 3, 3, 4, 4, 5, 4],
  [5, 4, 5, 5, 3, 3, 2, 2, 3, 3, 4, 5],
]
export const TEAM_VIEW_FIGURES = [
  { theme: 'Purpose and priorities', level: '4.5', agreement: 'high' },
  { theme: 'Meetings', level: '3.0', agreement: 'low' },
  { theme: 'Dialogue and conflict', level: '3.3', agreement: 'high' },
  { theme: 'Working as one team', level: '2.4', agreement: 'high' },
  { theme: 'Safety and trust', level: '3.3', agreement: 'medium' },
  { theme: 'Results', level: '4.5', agreement: 'high' },
]

/** The team view's three states, each led by the flow leader */
export const TEAM_STATES = {
  released: {
    org: { id: id('0a000000', 201), name: 'Flow team view group' },
    group: { id: id('0b000000', 201), name: 'Flow team view group' },
    scan: { id: id('0c000000', 201), code: 'flowTeamViewReleased00001', size: 4 },
  },
  extended: {
    org: { id: id('0a000000', 202), name: 'Flow extended group' },
    group: { id: id('0b000000', 202), name: 'Flow extended group' },
    scan: { id: id('0c000000', 202), code: 'flowTeamViewExtended00001', size: 6 },
  },
  closed: {
    org: { id: id('0a000000', 203), name: 'Flow no team view group' },
    group: { id: id('0b000000', 203), name: 'Flow no team view group' },
    scan: { id: id('0c000000', 203), code: 'flowTeamViewClosed0000001', size: 6 },
  },
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const answersOf = (values) => `(select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', (${q(JSON.stringify(values))}::jsonb ->> (vi.ordinal - 1))::int) order by vi.ordinal)
    from app.scan_session ss join app.instrument_version_item vi on vi.instrument_version_id = ss.instrument_version_id where ss.code = c)`

/** The SQL, as one script: remove the fixture's own rows, then write them again */
export function render({ e2e = false } = {}) {
  const leads = [{ ...FLOW_LEADER, role: 'leader' }]
  // opened two weeks ago, so a closing date moved back to now is still after the opening (0006)
  const states = Object.values(TEAM_STATES).map((g) => ({ ...g, people: leads, demo: false, opened: "now() - interval '14 days'" }))
  const groups = [{ ...LUMIO, demo: true }, ...(e2e ? [...E2E_GROUPS.map((g) => ({ ...g, people: [], demo: false })), ...states] : [])]
  const accounts = [...LUMIO.people, ...(e2e ? [FLOW_LEADER] : [])]
  const orgIds = groups.map((g) => q(g.org.id)).join(', ')
  const peopleIds = accounts.map((p) => q(p.id)).join(', ')
  const lines = []
  lines.push(`-- generated by scripts/seed/fixture.mjs; local databases only`)
  lines.push(`delete from app.organisation where id in (${orgIds});`)
  // and the groups the flow leader made in an earlier run, which a reset would otherwise leave behind
  lines.push(`delete from app.organisation where id in (select m.org_id from app.membership m where m.person_id = ${q(FLOW_LEADER.id)});`)
  lines.push(`delete from auth.users where id in (${[...LUMIO.people, FLOW_LEADER].map((p) => q(p.id)).join(', ')});`)

  // auth.users: the full row on real Supabase, so the known password signs in; id and email on the stub
  const people = accounts
    .map((p) => `(${q(p.id)}::uuid, ${q(p.email)})`)
    .join(',\n    ')
  lines.push(`do $$
declare v_full boolean := exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'encrypted_password');
begin
  if v_full then
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
           extensions.crypt(${q(FIXTURE_PASSWORD)}, extensions.gen_salt('bf')), now(),
           '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
    from (values
    ${people}) u (id, email);
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
    from auth.users u where u.id in (${peopleIds});
  else
    insert into auth.users (id, email)
    select u.id, u.email from (values
    ${people}) u (id, email);
  end if;
end $$;`)
  lines.push(
    `insert into app.person (id, display_name) values\n  ${accounts.map((p) => `(${q(p.id)}, ${q(p.name)})`).join(',\n  ')};`,
  )

  for (const g of groups) {
    lines.push(`insert into app.organisation (id, name, is_demo) values (${q(g.org.id)}, ${q(g.org.name)}, ${g.demo});`)
    lines.push(`insert into app.team (id, org_id, name) values (${q(g.group.id)}, ${q(g.org.id)}, ${q(g.group.name)});`)
    for (const p of g.people) {
      lines.push(`insert into app.membership (org_id, team_id, person_id, role) values (${q(g.org.id)}, ${q(g.group.id)}, ${q(p.id)}, ${q(p.role)});`)
    }
    lines.push(`insert into app.scan_session (id, org_id, team_id, instrument_version_id, code, member_count, k, window_days, opens_at, closes_at)
select ${q(g.scan.id)}, ${q(g.org.id)}, ${q(g.group.id)}, v.id, ${q(g.scan.code)}, ${g.scan.size}, app.k_threshold(${q(g.org.id)}),
       app.setting_int('scan_window_days'), ${g.opened ?? 'now()'}, now() + make_interval(days => app.setting_int('scan_window_days'))
from app.instrument_version v join app.instrument i on i.id = v.instrument_id
where i.key = 'scan' and v.status = 'published' order by v.version desc limit 1;`)
  }

  // Kari's answers, through the write path: every item 3
  lines.push(`do $$
declare v_reply jsonb;
begin
  select app.submit_scan(${q(LUMIO.scan.code)}, jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 3) order by vi.ordinal), null)
    into v_reply
  from app.scan_session ss join app.instrument_version_item vi on vi.instrument_version_id = ss.instrument_version_id
  where ss.id = ${q(LUMIO.scan.id)};
  if not (v_reply ->> 'ok')::boolean then
    raise exception 'fixture: the leader''s answers were refused (%)', v_reply ->> 'reason';
  end if;
end $$;`)
  if (e2e) {
    // the released group: four answers take its four seats, and the last closes it (0006)
    lines.push(`do $$
declare c text := ${q(TEAM_STATES.released.scan.code)}; v_reply jsonb;
begin
${TEAM_VIEW_ANSWERS.map((values) => `  v_reply := app.submit_scan(c, ${answersOf(values)}, null);
  if not (v_reply ->> 'ok')::boolean then raise exception 'fixture: a team view answer was refused (%)', v_reply ->> 'reason'; end if;`).join('\n')}
  if (select phase from app.scan_session where code = c) <> 'released' then raise exception 'fixture: the team view group did not release'; end if;
end $$;`)
    // the extended and the closed group: three answers each, then one or two deadlines
    for (const [state, deadlines] of [['extended', 1], ['closed', 2]]) {
      const scan = TEAM_STATES[state].scan
      lines.push(`do $$
declare c text := ${q(scan.code)}; v_reply jsonb;
begin
${TEAM_VIEW_ANSWERS.slice(0, 3).map((values) => `  v_reply := app.submit_scan(c, ${answersOf(values)}, null);
  if not (v_reply ->> 'ok')::boolean then raise exception 'fixture: an answer was refused (%)', v_reply ->> 'reason'; end if;`).join('\n')}
end $$;`)
      for (let i = 0; i < deadlines; i++) {
        lines.push(`alter table app.scan_session disable trigger scan_session_fixed;
update app.scan_session set closes_at = now() - interval '1 second' where id = ${q(scan.id)};
alter table app.scan_session enable trigger scan_session_fixed;
select app.close_scan(${q(scan.id)});`)
      }
      lines.push(`do $$ begin
  if (select phase from app.scan_session where id = ${q(scan.id)}) <> ${q(state === 'extended' ? 'open' : 'closed')} then raise exception 'fixture: the ${state} group is not ${state}'; end if;
end $$;`)
    }
  }
  return lines.join('\n') + '\n'
}

export function localOnly(url) {
  let host
  try {
    host = new URL(url).hostname
  } catch {
    return false
  }
  return host === '127.0.0.1' || host === 'localhost'
}

function main(argv) {
  const at = argv.indexOf('--db')
  const db =
    (at >= 0 ? argv[at + 1] : undefined) ?? process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  if (!localOnly(db)) {
    console.error('fixture: refused. The fixture writes known passwords and fixed codes, so it runs on 127.0.0.1 or localhost only.')
    process.exit(2)
  }
  execFileSync('psql', [db, '-X', '-q', '-1', '-v', 'ON_ERROR_STOP=1'], { input: render({ e2e: argv.includes('--e2e') }), stdio: ['pipe', 'inherit', 'inherit'] })
  console.log(`fixture: ${LUMIO.org.name}, ${LUMIO.group.name} (${LUMIO.people.length}), scan /j/${LUMIO.scan.code}`)
  if (argv.includes('--e2e')) for (const g of E2E_GROUPS) console.log(`fixture: ${g.group.name} for ${g.project}, scan /j/${g.scan.code}`)
}

// run as a script, not when the flows import its constants (Playwright loads this file without import.meta)
if (process.argv[1] && basename(process.argv[1]) === 'fixture.mjs') main(process.argv.slice(2))

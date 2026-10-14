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
 * 5. **The billing flow's group** (`--e2e`, milestone 8), with a leader and a member of its own, and the
 *    development payment adapter (0013), so a local checkout succeeds or fails on demand. A hosted database
 *    keeps the adapter `none`: it is never seeded.
 * 6. **The charter and members flow's group** (`--e2e`, milestone 9), on its 14-day trial so the Team plan's
 *    group page is real (0013, 0014): a leader and a member, and an invitee with an account and no group, whom
 *    the flow invites and lets join.
 * 7. **The diagnostic round's groups** (`--e2e`, milestone 10), both on their trial with the same five people:
 *    one with no round yet, where the flow opens the Full diagnostic and two of them answer; and one with a
 *    round in each of the other states, opened through `open_round` and answered through `submit_response`
 *    as each person: round 1 released at 4 of 5, round 2 closed with no result at 2 of 5 (its extension,
 *    then its second deadline), and round 3 answering at 3 of 5.
 * 8. **The product screenshots' groups** (`--shots`, D-44): the Lumio leadership group as the public site
 *    pictures it, with the design's names, in its own organisation and accounts so no flow shares a row. Kari
 *    Nordmann leads it on its trial: its scan released from eight answers, its charter at version 2, a Full
 *    diagnostic answering at 5 of 8, and her Leader Profile shared with the group at the level of domains.
 *    Beside it, the sales leadership group, led by Ingrid Berg, with its scan open at 3 of 7. Every answer
 *    goes through its write path, as each person where the path needs one. `scripts/shots/capture.mjs` takes
 *    the pictures from these rows.
 * 9. **Deterministic, and local only.** Fixed ids, link codes and a known password, so a reset gives the
 *    same rows and a test can name them. That is why the script refuses any database that is not on
 *    127.0.0.1 or localhost (REUSE 4.12: Orgpuls's fixture did not, and its tokens are derivable).
 * 10. **Idempotent.** It removes its own rows first, by their fixed ids, in one transaction.
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

/** The billing flow's group (milestone 8): a leader who upgrades it and a member who sees the plan, each signing in on their own */
export const BILLING = {
  org: { id: id('0a000000', 301), name: 'Flow billing group' },
  group: { id: id('0b000000', 301), name: 'Flow billing group' },
  scan: { id: id('0c000000', 301), code: 'flowBillingScanCode000001', size: 4 },
  leader: { id: id('4c0e0000', 902), name: 'Billing leader', email: 'billing.leader@lumio.example' },
  member: { id: id('4c0e0000', 903), name: 'Billing member', email: 'billing.member@lumio.example' },
}

/** The charter and members flow's group (milestone 9): on its trial, with an invitee who has no group yet */
export const GROUP_FLOW = {
  org: { id: id('0a000000', 401), name: 'Flow charter group' },
  group: { id: id('0b000000', 401), name: 'Flow charter group' },
  scan: { id: id('0c000000', 401), code: 'flowCharterScanCode000001', size: 4 },
  leader: { id: id('4c0e0000', 904), name: 'Charter leader', email: 'charter.leader@lumio.example' },
  member: { id: id('4c0e0000', 905), name: 'Charter member', email: 'charter.member@lumio.example' },
  invitee: { id: id('4c0e0000', 906), name: 'Charter invitee', email: 'charter.invitee@lumio.example' },
}

/** The diagnostic round's people (milestone 10): a leader and four members, in both round groups */
const ROUND_PEOPLE = [
  { id: id('4c0e0000', 907), name: 'Round leader', email: 'round.leader@lumio.example', role: 'leader' },
  { id: id('4c0e0000', 908), name: 'Round member', email: 'round.member@lumio.example', role: 'member' },
  { id: id('4c0e0000', 909), name: 'Round member two', email: 'round.member2@lumio.example', role: 'member' },
  { id: id('4c0e0000', 910), name: 'Round member three', email: 'round.member3@lumio.example', role: 'member' },
  { id: id('4c0e0000', 911), name: 'Round member four', email: 'round.member4@lumio.example', role: 'member' },
]

/** The group where the flow opens the Full diagnostic and answers it (tests/e2e/assess.spec.ts) */
export const ROUND_FLOW = {
  org: { id: id('0a000000', 501), name: 'Flow round group' },
  group: { id: id('0b000000', 501), name: 'Flow round group' },
  scan: { id: id('0c000000', 501), code: 'flowRoundScanCode00000001', size: 5 },
  leader: ROUND_PEOPLE[0],
  member: ROUND_PEOPLE[1],
  people: ROUND_PEOPLE,
}

/** The group with a round in each state after answering: released, closed with no result, answering */
export const ROUND_STATES = {
  org: { id: id('0a000000', 502), name: 'Flow round states group' },
  group: { id: id('0b000000', 502), name: 'Flow round states group' },
  scan: { id: id('0c000000', 502), code: 'flowRoundStatesScan000001', size: 5 },
  rounds: { released: id('0d000000', 501), closed: id('0d000000', 502), answering: id('0d000000', 503) },
  people: ROUND_PEOPLE,
}

/**
 * The product screenshots' groups (--shots, D-44): the Lumio leadership group of 8, with the design's names, in
 * accounts of its own, and the sales leadership group beside it with its scan still open.
 */
const SHOT_NAMES = ['Kari Nordmann', 'Ola Hansen', 'Ingrid Berg', 'Lars Johansen', 'Sofie Lie', 'Erik Dahl', 'Maja Strand', 'Henrik Bakke']
const SHOT_PEOPLE = SHOT_NAMES.map((name, i) => ({
  id: id('4c0e0000', 951 + i),
  name,
  email: `${name.toLowerCase().replace(' ', '.')}@shots.lumio.example`,
  role: i === 0 ? 'leader' : 'member',
}))
export const SHOTS = {
  org: { id: id('0a000000', 601), name: 'Lumio AS' },
  group: { id: id('0b000000', 601), name: 'Lumio leadership group' },
  scan: { id: id('0c000000', 601), code: 'lumioShotsLeadershipScan1', size: 8 },
  round: id('0d000000', 601),
  people: SHOT_PEOPLE,
  /** who has answered the round: Kari and four members; Erik, Maja and Henrik have not */
  answered: [0, 1, 2, 3, 4],
  sales: {
    group: { id: id('0b000000', 602), name: 'Lumio sales leadership group' },
    scan: { id: id('0c000000', 602), code: 'lumioShotsSalesScan000001', size: 7 },
    // Ingrid leads it; six of the others are its members
    people: [{ ...SHOT_PEOPLE[2], role: 'leader' }, ...[1, 3, 4, 5, 6, 7].map((i) => ({ ...SHOT_PEOPLE[i], role: 'member' }))],
    answers: 3,
  },
}

/**
 * The leadership group's eight answer sets, in the scan's item order (two items per theme): a group that agrees on
 * purpose and results, sits low on working as one team, half agrees on safety and trust, and differs on meetings,
 * so the team view shows each agreement label and the standing they lead to.
 */
const SHOT_ANSWERS = [
  [4, 4, 1, 1, 3, 3, 2, 3, 2, 3, 4, 4],
  [5, 4, 4, 5, 3, 4, 3, 3, 4, 5, 4, 5],
  [4, 4, 2, 2, 4, 3, 2, 2, 3, 3, 4, 4],
  [4, 5, 4, 4, 3, 3, 3, 2, 4, 5, 5, 4],
  [4, 4, 1, 2, 2, 2, 2, 3, 2, 2, 4, 4],
  [5, 5, 5, 4, 3, 3, 3, 3, 4, 4, 4, 4],
  [4, 3, 2, 2, 4, 4, 2, 2, 3, 4, 3, 4],
  [4, 4, 4, 3, 3, 4, 2, 3, 5, 4, 4, 4],
]

/** The charter the screenshots show, agreed twice: version 2 adds the last working agreement */
const SHOT_CHARTER = {
  purpose:
    'We set the direction for Lumio and decide the few things that need all of us: priorities, how resources are split between units, and the changes that cross them.',
  tasks: [
    { title: 'Annual priorities and how the budget is split between units', right: 'decide' },
    { title: 'Initiatives that cross two or more units', right: 'decide' },
    { title: 'Key appointments in the units', right: 'advise' },
    { title: 'Major changes to customers, prices or products', right: 'advise' },
    { title: 'Quarterly results and the main risks', right: 'inform' },
  ],
  agreements: [
    'We read the papers before we meet.',
    'Every item states the outcome it needs.',
    'We disagree in the room, not afterwards.',
    'Once we decide, we explain the decision as one team.',
  ],
  added: 'We end each meeting by reading back who does what by when.',
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const answersOf = (values) => `(select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', (${q(JSON.stringify(values))}::jsonb ->> (vi.ordinal - 1))::int) order by vi.ordinal)
    from app.scan_session ss join app.instrument_version_item vi on vi.instrument_version_id = ss.instrument_version_id where ss.code = c)`

/** The SQL, as one script: remove the fixture's own rows, then write them again */
export function render({ e2e = false, shots = false } = {}) {
  const leads = [{ ...FLOW_LEADER, role: 'leader' }]
  // opened two weeks ago, so a closing date moved back to now is still after the opening (0006)
  const states = Object.values(TEAM_STATES).map((g) => ({ ...g, people: leads, demo: false, opened: "now() - interval '14 days'" }))
  const billing = { ...BILLING, demo: false, people: [{ ...BILLING.leader, role: 'leader' }, { ...BILLING.member, role: 'member' }] }
  const charter = { ...GROUP_FLOW, demo: false, trial: true, people: [{ ...GROUP_FLOW.leader, role: 'leader' }, { ...GROUP_FLOW.member, role: 'member' }] }
  // members since before the oldest round the fixture opens
  const rounds = [ROUND_FLOW, ROUND_STATES].map((g) => ({ ...g, demo: false, trial: true, since: "now() - interval '120 days'" }))
  // the screenshots' two groups share one organisation, so the second carries no organisation row of its own
  const shotGroups = [
    { ...SHOTS, demo: false, trial: true, since: "now() - interval '200 days'", opened: "now() - interval '30 days'" },
    { ...SHOTS.sales, org: SHOTS.org, sameOrg: true, demo: false, since: "now() - interval '200 days'", opened: "now() - interval '4 days'" },
  ]
  const groups = [
    { ...LUMIO, demo: true },
    ...(e2e ? [...E2E_GROUPS.map((g) => ({ ...g, people: [], demo: false })), ...states, billing, charter, ...rounds] : []),
    ...(shots ? shotGroups : []),
  ]
  const accounts = [
    ...LUMIO.people,
    ...(e2e ? [FLOW_LEADER, BILLING.leader, BILLING.member, GROUP_FLOW.leader, GROUP_FLOW.member, GROUP_FLOW.invitee, ...ROUND_PEOPLE] : []),
    ...(shots ? SHOT_PEOPLE : []),
  ]
  const orgIds = [...new Set(groups.map((g) => g.org.id))].map(q).join(', ')
  const peopleIds = accounts.map((p) => q(p.id)).join(', ')
  const lines = []
  lines.push(`-- generated by scripts/seed/fixture.mjs; local databases only`)
  lines.push(`delete from app.organisation where id in (${orgIds});`)
  // and the groups the flow leader made in an earlier run, which a reset would otherwise leave behind
  lines.push(`delete from app.organisation where id in (select m.org_id from app.membership m where m.person_id = ${q(FLOW_LEADER.id)});`)
  lines.push(
    `delete from auth.users where id in (${[...LUMIO.people, FLOW_LEADER, BILLING.leader, BILLING.member, GROUP_FLOW.leader, GROUP_FLOW.member, GROUP_FLOW.invitee, ...ROUND_PEOPLE, ...SHOT_PEOPLE].map((p) => q(p.id)).join(', ')});`,
  )
  // a local database completes checkouts with the development adapter (0013): it succeeds or fails on demand
  lines.push(`update app.payment_adapter set adapter = 'development';`)

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
    if (!g.sameOrg) lines.push(`insert into app.organisation (id, name, is_demo) values (${q(g.org.id)}, ${q(g.org.name)}, ${g.demo});`)
    lines.push(`insert into app.team (id, org_id, name) values (${q(g.group.id)}, ${q(g.org.id)}, ${q(g.group.name)});`)
    for (const p of g.people) {
      lines.push(
        `insert into app.membership (org_id, team_id, person_id, role, valid_from) values (${q(g.org.id)}, ${q(g.group.id)}, ${q(p.id)}, ${q(p.role)}, ${g.since ?? 'now()'});`,
      )
    }
    // the Team plan's trial, 14 days from now (0013)
    if (g.trial) lines.push(`insert into app.trial (team_id, org_id, ends_at) values (${q(g.group.id)}, ${q(g.org.id)}, now() + make_interval(days => app.setting_int('trial_days')));`)
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
    lines.push(roundStates())
  }
  if (shots) lines.push(shotStates())
  return lines.join('\n') + '\n'
}

/** Runs one statement as a person, the way a signed-in call does: their id in the request's claims */
const as = (person, statement) => `  perform set_config('request.jwt.claims', json_build_object('sub', ${q(person.id)}, 'role', 'authenticated')::text, true);
  v_reply := ${statement};
  if not (v_reply ->> 'ok')::boolean then raise exception 'fixture: shots refused % (%)', ${q(statement.slice(0, 40))}, v_reply ->> 'reason'; end if;`

/**
 * The screenshots' states (--shots, D-44), each through its write path: the leadership group's scan released by
 * its eighth answer; its charter drafted and agreed as Kari, twice; a Full diagnostic opened three days ago and
 * answered by five; Kari's Leader Profile, shared with the group at the level of domains; and the sales group's
 * scan, open at 3 of 7.
 */
function shotStates() {
  const g = SHOTS
  const kari = g.people[0]
  const v1 = { purpose: SHOT_CHARTER.purpose, tasks: SHOT_CHARTER.tasks, agreements: SHOT_CHARTER.agreements }
  const v2 = { ...v1, agreements: [...SHOT_CHARTER.agreements, SHOT_CHARTER.added] }
  const charter = (c) =>
    `app.save_charter_draft(${q(g.group.id)}, ${q(c.purpose)}, ${q(JSON.stringify(c.tasks))}::jsonb, ${q(JSON.stringify(c.agreements))}::jsonb)`
  return `do $$
declare c text := ${q(g.scan.code)}; v_reply jsonb; v_answers jsonb;
begin
${SHOT_ANSWERS.map((values) => `  v_reply := app.submit_scan(c, ${answersOf(values)}, null);
  if not (v_reply ->> 'ok')::boolean then raise exception 'fixture: a shots answer was refused (%)', v_reply ->> 'reason'; end if;`).join('\n')}
  if (select phase from app.scan_session where code = c) <> 'released' then raise exception 'fixture: the shots group did not release'; end if;

  c := ${q(g.sales.scan.code)};
${SHOT_ANSWERS.slice(0, g.sales.answers).map((values) => `  v_reply := app.submit_scan(c, ${answersOf(values)}, null);
  if not (v_reply ->> 'ok')::boolean then raise exception 'fixture: a sales answer was refused (%)', v_reply ->> 'reason'; end if;`).join('\n')}

${as(kari, charter(v1))}
${as(kari, `app.agree_charter(${q(g.group.id)})`)}
${as(kari, charter(v2))}
${as(kari, `app.agree_charter(${q(g.group.id)})`)}

  insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, window_days, opens_at)
  values (${q(g.round)}, ${q(g.org.id)}, ${q(g.group.id)}, 'diagnostic', app.diagnostic_version(), 14, now() - interval '3 days');
  if app.open_round(${q(g.round)}) <> ${g.people.length} then raise exception 'fixture: the shots round did not invite everyone'; end if;
${g.answered
  .map(
    (i) => `  select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 2 + (vi.ordinal + ${i}) % 4) order by vi.ordinal) into v_answers
  from app.instrument_version_item vi where vi.instrument_version_id = app.diagnostic_version();
${as(g.people[i], `app.submit_response(${q(g.round)}, v_answers)`)}`,
  )
  .join('\n')}

  select jsonb_object_agg(i.id::text, 1 + (i.ordinal * 7) % 5) into v_answers
  from app.profile_item i join app.profile_test t on t.id = i.test_id where t.key = 'quick' and t.status = 'published';
${as(kari, `app.save_profile('quick', v_answers)`)}
${as(kari, `app.set_profile_share(${q(g.group.id)}, 'domains')`)}
  perform set_config('request.jwt.claims', '', true);
end $$;`
}

/**
 * The round states' group: each round opened through open_round and answered through submit_response as
 * each person, then closed through close_round after its date is moved back, with the round's guard off for
 * that one statement, as the suites do. Round 1: 4 of 5, released. Round 2: 2 of 5, extended at its first
 * date, closed with no result at its second. Round 3: 3 of 5, answering.
 */
function roundStates() {
  const g = ROUND_STATES
  const plan = [
    { round: g.rounds.released, opened: 90, answer: [1, 2, 3, 4], deadlines: 1, phase: 'released' },
    { round: g.rounds.closed, opened: 40, answer: [1, 2], deadlines: 2, phase: 'closed' },
    { round: g.rounds.answering, opened: 2, answer: [2, 3, 4], deadlines: 0, phase: 'answering' },
  ]
  return plan
    .map(
      (r) => `do $$
declare v_reply jsonb; v_answers jsonb;
begin
  insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, window_days, opens_at)
  values (${q(r.round)}, ${q(g.org.id)}, ${q(g.group.id)}, 'diagnostic', app.diagnostic_version(), 14, now() - interval '${r.opened} days');
  if app.open_round(${q(r.round)}) <> ${g.people.length} then raise exception 'fixture: round ${r.phase} did not invite everyone'; end if;
${r.answer
  .map(
    (i) => `  select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 1 + (vi.ordinal + ${i}) % 5) order by vi.ordinal) into v_answers
  from app.instrument_version_item vi where vi.instrument_version_id = app.diagnostic_version();
  perform set_config('request.jwt.claims', json_build_object('sub', ${q(g.people[i].id)}, 'role', 'authenticated')::text, true);
  v_reply := app.submit_response(${q(r.round)}, v_answers);
  if not (v_reply ->> 'ok')::boolean then raise exception 'fixture: a round answer was refused (%)', v_reply ->> 'reason'; end if;`,
  )
  .join('\n')}
  perform set_config('request.jwt.claims', '', true);
end $$;
alter table app.assessment_round disable trigger assessment_round_fixed;
update app.assessment_round set closes_at = opens_at + interval '14 days' where id = ${q(r.round)};
alter table app.assessment_round enable trigger assessment_round_fixed;
${Array.from(
  { length: r.deadlines },
  (_, i) => `alter table app.assessment_round disable trigger assessment_round_fixed;
update app.assessment_round set closes_at = opens_at + interval '${14 + 7 * i} days' where id = ${q(r.round)};
alter table app.assessment_round enable trigger assessment_round_fixed;
select app.close_round(${q(r.round)});`,
).join('\n')}
do $$ begin
  if (select phase from app.assessment_round where id = ${q(r.round)}) <> ${q(r.phase)} then raise exception 'fixture: round ${r.phase} is not ${r.phase}'; end if;
end $$;`,
    )
    .join('\n')
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
  execFileSync('psql', [db, '-X', '-q', '-1', '-v', 'ON_ERROR_STOP=1'], {
    input: render({ e2e: argv.includes('--e2e'), shots: argv.includes('--shots') }),
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  console.log(`fixture: ${LUMIO.org.name}, ${LUMIO.group.name} (${LUMIO.people.length}), scan /j/${LUMIO.scan.code}`)
  if (argv.includes('--e2e')) for (const g of E2E_GROUPS) console.log(`fixture: ${g.group.name} for ${g.project}, scan /j/${g.scan.code}`)
  if (argv.includes('--shots')) console.log(`fixture: ${SHOTS.group.name} and ${SHOTS.sales.group.name}, for the product screenshots`)
}

// run as a script, not when the flows import its constants (Playwright loads this file without import.meta)
if (process.argv[1] && basename(process.argv[1]) === 'fixture.mjs') main(process.argv.slice(2))

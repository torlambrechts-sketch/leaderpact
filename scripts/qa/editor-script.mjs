/**
 * The owner's SQL-editor script for migrations the Supabase connector holds back (D-22).
 *
 *   node scripts/qa/editor-script.mjs 0006_scan 0007_rounds 0008_firewall > hosted.sql
 *
 * The connector asks for a confirmation that never reaches a cloud session when a query holds two or
 * more DELETE statements, even inside a function body, and the call times out with nothing run. The SQL
 * is not reshaped to pass that check. Instead the owner runs this script in the SQL editor of the
 * LeaderPact project:
 *
 * 1. **One transaction.** If any statement fails, nothing is applied.
 * 2. **The committed files, verbatim**, in the order given, each followed by its history row exactly as
 *    `apply_migration` writes it: the file without its trailing newline as the one statement, and the
 *    `created_by` of the migration before. The hosted check is md5(array_to_string(statements, '')).
 * 3. **A guard first.** It refuses any project without `app.k_max()` = 8, and refuses unless the
 *    migration before the first is applied and none of these is.
 * 4. **The firewall last**, so the owner sees six rows that pass.
 *
 * Rehearse the output on a local database built to the migration before (scripts/qa/local-pg.sh) before
 * handing it over. It writes to stdout and touches no database.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const dir = resolve(import.meta.dirname, '../../supabase/migrations')
const all = readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => f.slice(0, -4)).sort()
const names = process.argv.slice(2)
if (names.length === 0 || names.some((n) => !all.includes(n))) {
  console.error('editor-script: name committed migrations, without .sql, in order')
  process.exit(2)
}
const first = all.indexOf(names[0])
if (first < 1 || names.some((n, i) => all.indexOf(n) !== first + i)) {
  console.error('editor-script: the migrations must follow one another and not start at the first')
  process.exit(2)
}
const before = all[first - 1]
const list = names.map((n) => `'${n}'`).join(', ')

let out = `-- LeaderPact: hosted migrations ${names.join(', ')}, for the SQL editor of Supabase project
-- leaderpact (ref tgxjbshdjwoemsmrtkzw). Run it once, as it is. Nothing else needs changing.
--
-- It applies the committed files verbatim, in one transaction, and records each in the migration history
-- exactly as apply_migration would. If anything fails, nothing is applied.
-- It refuses to run on any other project, or if these migrations are already there.
-- The last result is the anonymity firewall: six rows, every one pass = true.

begin;

do $lp_guard$
begin
  if to_regprocedure('app.k_max()') is null then
    raise exception 'Not the LeaderPact project. Nothing was changed.';
  end if;
  if (select app.k_max()) <> 8
     or not exists (select 1 from supabase_migrations.schema_migrations where name = '${before}')
     or exists (select 1 from supabase_migrations.schema_migrations where name in (${list})) then
    raise exception 'Not the LeaderPact project at ${before}, or these migrations are already applied. Nothing was changed.';
  end if;
end $lp_guard$;
`
names.forEach((n, i) => {
  const text = readFileSync(join(dir, `${n}.sql`), 'utf8')
  const body = text.endsWith('\n') ? text.slice(0, -1) : text
  const tag = `$lp_m${n.slice(0, 4)}$`
  if (body.includes(tag)) {
    console.error(`editor-script: ${n} contains ${tag}`)
    process.exit(2)
  }
  out += `\n-- ======================================================================== ${n}.sql\n${body}\n`
  out += `
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select to_char((now() + interval '${i} second') at time zone 'utc', 'YYYYMMDDHH24MISS'), '${n}', array[${tag}${body}${tag}], m.created_by
from supabase_migrations.schema_migrations m where m.name = '${before}';
`
})
out += `
commit;

select seq, rule, pass from app.anonymity_firewall() order by seq;
`
process.stdout.write(out)

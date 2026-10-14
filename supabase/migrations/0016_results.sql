-- 0016_results.sql — what a scale means, for the results in three depths (handoff 6.12; milestone 11: "Every
-- row shows level, agreement label and one standing. No forbidden element appears"; D-45).
--
-- 1. **A scale's definition is a row,** versioned like the item wording (CLAUDE.md, Model as data): one
--    sentence per scale and outcome, in `factor_text`, read on the scale's page. Version 1 is the owner's
--    design bundle's (design/reference/proto-core-v5.js, `SDEF`), mapped to the keys of Appendix A: neither
--    the handoff nor the item bank has definitions. A new wording is a new version; a row never changes.
-- 2. **Nothing else changes in the database.** The results are the snapshot written at close (0007) and read
--    through `get_results` and `get_item_results`, the firewall's reviewed readers: levels, agreement labels
--    and standings for a released round at or above its threshold, for current members only. Change between
--    two released rounds is worked out in the app from those readers and the instrument versions' items.

-- ---------------------------------------------------------------- definitions, versioned
create table app.factor_text (
  factor_id uuid not null references app.factor (id),
  version int not null check (version > 0),
  definition jsonb not null check (jsonb_typeof(definition) = 'object' and definition ? 'en'),
  valid_from timestamptz not null,
  primary key (factor_id, version)
);
comment on table app.factor_text is
  'What each scale and outcome means, one sentence, versioned (handoff 6.12). A row never changes; a new wording is a new version.';

create function app.factor_text_fixed() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if (old.factor_id, old.version, old.definition, old.valid_from) is distinct from (new.factor_id, new.version, new.definition, new.valid_from) then
    raise exception 'a definition''s version never changes: add a new one' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger factor_text_fixed before update on app.factor_text for each row execute function app.factor_text_fixed();

alter table app.factor_text enable row level security;
-- reference text, as the scales themselves are (0003): anyone may read it, nobody writes it but a migration
create policy factor_text_read on app.factor_text for select to anon, authenticated using (true);
grant select on app.factor_text to anon, authenticated;

insert into app.factor_text (factor_id, version, definition, valid_from)
select f.id, 1, jsonb_build_object('en', d.definition), '2026-01-01T00:00:00Z'
from (values
  ('clear_purpose', 'How clear and shared the reason for this team is.'),
  ('team_tasks', 'Whether the team knows which tasks and decisions belong to it.'),
  ('size_and_membership', 'Whether the team has the right number of members, with clear membership.'),
  ('composition', 'The mix of skills and views in the team.'),
  ('rewards', 'Whether goals and recognition reward working as one team.'),
  ('information_and_support', 'Whether the team gets the information and support it needs.'),
  ('preparation', 'How well members and items are prepared before meetings.'),
  ('meeting_goals', 'Whether each agenda item has a clear desired outcome.'),
  ('focus', 'Whether discussions stay on what matters most.'),
  ('dialogue', 'How members listen, ask and build on each other.'),
  ('task_conflict', 'Open disagreement about the work itself.'),
  ('relationship_conflict', 'Personal friction between members.'),
  ('political_behaviour', 'Hidden agendas, side deals and turf protection.'),
  ('behavioural_integration', 'How much members share information and decide together.'),
  ('external_relations', 'How the team manages its relations with the rest of the company.'),
  ('learning', 'Whether the team reflects and changes how it works.'),
  ('team_leadership', 'How the team leader sets direction and runs the team.'),
  ('psychological_safety', 'Whether members can take risks and admit mistakes.'),
  ('trust', 'Whether members rely on each other to deliver.'),
  ('cohesion', 'How strongly members feel part of one team.'),
  ('norms', 'Whether the team keeps and enforces its working agreements.'),
  ('direction_alignment_and_commitment', 'Shared direction, aligned work and commitment to decisions.'),
  ('viability', 'Whether the team can keep working well over time.'),
  ('member_growth', 'Whether being in the team helps members develop.')
) as d (key, definition)
join app.factor f on f.key = d.key;

do $$
begin
  if (select count(*) from app.factor_text where version = 1) <> (select count(*) from app.factor) then
    raise exception 'every scale and outcome needs its definition';
  end if;
end $$;

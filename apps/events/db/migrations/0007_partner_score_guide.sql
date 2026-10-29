-- Startup-partner teams get their own 1/3/5 score guide and red flags, so a
-- partner table isn't told "1 = Built things, but talked to no one".
-- (partner_strong_signals already exists and is used as the partner "5".)

alter table invest_rubric_pillars
  add column partner_weak_signals     text not null default '',
  add column partner_partial_signals  text not null default '';

-- Partner wording for the rubric v2 default pillars, by key.
create or replace function invest_partner_guide_text()
returns table (key text, weak text, partial text, strong text, red text)
language sql
immutable
as $$
  values
    ('problem',
     'Can''t explain the partner''s problem, or only repeats what they were told to build.',
     'Knows the partner''s problem in general terms, but not what it costs them or how they coped before.',
     'Explains the partner''s pain in the partner''s own words, with numbers or examples, and how it was handled before.',
     'Doing whatever was asked without knowing why it matters
Describes the task, not the partner''s problem'),
    ('customer',
     'Doesn''t know who the partner sells to.',
     'Knows the partner''s customer group, but hasn''t talked to them or can''t say where the team''s work reaches them.',
     'Knows the partner''s customers well, has heard from some directly, and can show exactly where the team''s work makes a difference to them.',
     'Never spoke to the partner''s customers or users
Can''t say who benefits from the work'),
    ('solution',
     'No view of what the partner really needs; just the assigned task.',
     'A rough idea of what would fix it, loosely tied to the partner''s problem.',
     'A crisp "the partner needs a ___ that does ___" that follows from the problem, even if it differs from the original ask.',
     'Never questioned whether the assigned task is the right fix'),
    ('product',
     'Nothing delivered yet, or only plans and slides.',
     'Early work delivered, but the partner isn''t using it yet or it only partly fits.',
     'Concrete work the partner actually uses, shown in a demo or with examples.',
     'Plans and slides only
Work the partner hasn''t adopted'),
    ('business',
     'Can''t say why the partner is better off.',
     'A believable kind of value (time saved, more sales), but no numbers.',
     'Ties the work to revenue, savings or growth for the partner, with rough numbers they agree with.',
     'No idea how anyone would measure the value'),
    ('traction',
     'No feedback from the partner yet.',
     'Some positive feedback, but nothing measured and little changed because of it.',
     'The partner has adopted the work and can point to a metric or decision it changed, plus clear lessons for the second half.',
     'Impact assumed, not shown
"They said they like it" as the only evidence')
$$;

-- Fill partner guides on existing rubric v2 pillars (events using the new default).
update invest_rubric_pillars p
set partner_weak_signals = d.weak,
    partner_partial_signals = d.partial,
    partner_strong_signals = case when p.partner_strong_signals = '' then d.strong else p.partner_strong_signals end,
    partner_red_flags = case when p.partner_red_flags = '' then d.red else p.partner_red_flags end
from invest_partner_guide_text() d
where p.key = d.key and p.weak_signals <> '' and p.partner_weak_signals = '';

-- New events: insert the default pillars, then add the partner guides.
alter function invest_insert_default_pillars(uuid) rename to invest_insert_default_pillars_base;

create function invest_insert_default_pillars(p_event uuid)
returns void
language plpgsql
as $$
begin
  perform invest_insert_default_pillars_base(p_event);
  update invest_rubric_pillars p
  set partner_weak_signals = d.weak,
      partner_partial_signals = d.partial,
      partner_strong_signals = d.strong,
      partner_red_flags = case when p.partner_red_flags = '' then d.red else p.partner_red_flags end
  from invest_partner_guide_text() d
  where p.event_id = p_event and p.key = d.key;
end;
$$;

-- Copying an event copies the partner guides too.
create or replace function invest_create_event(
  p_name text,
  p_slug text,
  p_starting_capital integer default null,
  p_clone_from uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_event uuid;
  v_capital integer;
begin
  v_capital := coalesce(
    p_starting_capital,
    (select starting_capital from events where id = p_clone_from),
    200000
  );

  insert into events (tool, name, slug, starting_capital)
  values ('invest', trim(p_name), lower(trim(p_slug)), v_capital)
  returning id into v_event;

  if p_clone_from is null then
    perform invest_insert_default_pillars(v_event);
  else
    insert into invest_rubric_pillars
      (event_id, key, label, prompt, strong_signals, red_flags,
       partner_prompt, partner_strong_signals, partner_red_flags, sort_order,
       listen_for, weak_signals, partial_signals, note, weight, partner_listen_for,
       partner_weak_signals, partner_partial_signals)
    select v_event, key, label, prompt, strong_signals, red_flags,
           partner_prompt, partner_strong_signals, partner_red_flags, sort_order,
           listen_for, weak_signals, partial_signals, note, weight, partner_listen_for,
           partner_weak_signals, partner_partial_signals
    from invest_rubric_pillars where event_id = p_clone_from;

    insert into invest_presenter_teams (event_id, name, one_liner, description, track, sort_order)
    select v_event, name, one_liner, description, track, sort_order
    from invest_presenter_teams where event_id = p_clone_from;

    insert into invest_investor_teams (event_id, name, max_members)
    select v_event, name, max_members
    from invest_investor_teams where event_id = p_clone_from;
  end if;

  return v_event;
end;
$$;

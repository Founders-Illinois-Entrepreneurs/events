-- Tracks: not every R&D team is building its own startup. Some partner with an
-- existing startup (consulting / contracting / mentorship). Every team is scored
-- on the same pillars so results stay comparable, but partner-track teams see
-- questions reworded for their situation.

alter table invest_presenter_teams
  add column track text not null default 'venture' check (track in ('venture', 'partner'));

alter table invest_rubric_pillars
  add column partner_prompt          text not null default '',
  add column partner_strong_signals  text not null default '',
  add column partner_red_flags       text not null default '';

-- Partner-track wording for the default pillars, keyed by pillar key.
create or replace function invest_default_partner_text()
returns table (key text, prompt text, strong text, red text)
language sql
immutable
as $$
  values
    ('problem',
     'Does the team understand the partner''s problem and why it matters to their business?',
     'Can explain the partner''s pain in the partner''s own words, backed by data or conversations with them.',
     'Doing whatever was asked without knowing why it matters.'),
    ('customer',
     'Who are the partner''s customers, and how does the team''s work reach them?',
     'Knows the partner''s target customer and market, and how their work moves it.',
     'Never talked to the partner''s users. Can''t say who benefits from the work.'),
    ('solution',
     'What has the team built or delivered for the partner, and is it the right thing?',
     'Concrete deliverables, a demo, or shipped work the partner actually uses.',
     'Plans and slides only. Work the partner hasn''t adopted.'),
    ('validation',
     'What evidence shows the work is helping the partner?',
     'Partner feedback, usage, metrics that moved, or decisions the partner made because of the team''s work.',
     'No feedback from the partner yet. Impact is assumed, not shown.'),
    ('team',
     'Is this team a strong partner: reliable, proactive, and learning fast?',
     'Clear scope and owners, regular check-ins, delivered on what they promised.',
     'Unclear roles, missed deadlines, waiting to be told what to do.'),
    ('business',
     'How does the team''s work create value for the partner''s business?',
     'Ties the work to revenue, cost savings, or growth for the partner, with rough numbers.',
     'Can''t explain why the partner is better off or how anyone would measure it.'),
    ('honesty',
     'Are they honest about what isn''t working in the engagement and what they''ll change?',
     'Names scope risks, blockers, and what they''ve learned. A plan for the second half.',
     'Everything is great, no blockers. Vague answers about whether the partner is happy.')
$$;

-- Fill in partner wording for existing default pillars that don't have any yet.
update invest_rubric_pillars p
set partner_prompt = d.prompt,
    partner_strong_signals = d.strong,
    partner_red_flags = d.red
from invest_default_partner_text() d
where p.key = d.key and p.partner_prompt = '';

-- New events get partner wording too.
create or replace function invest_insert_default_pillars(p_event uuid)
returns void
language plpgsql
as $$
begin
  insert into invest_rubric_pillars (event_id, key, label, prompt, strong_signals, red_flags, sort_order)
  values
    (p_event, 'problem', 'Problem',
     'Is this a real, painful, frequent problem?',
     'Specific stories from real people. Evidence of how often it happens and what it costs them today.',
     '"Everyone has this problem." Only the founders'' own opinion. A solution looking for a problem.', 1),
    (p_event, 'customer', 'Customer & Market',
     'Who exactly is the customer, how many are there, and how do you reach them?',
     'A narrow first customer they can name. A believable path to reach them. A sense of how big it can grow.',
     '"Our market is everyone." Big top-down market numbers with no first customer.', 2),
    (p_event, 'solution', 'Solution & Product',
     'Does the product solve the problem better than what people use today?',
     'A demo or working prototype. Clear advantage over current alternatives, including "do nothing".',
     'Feature lists with no link to the problem. Ignoring existing competitors.', 3),
    (p_event, 'validation', 'Validation & Traction',
     'What have they learned from real users since kickoff?',
     'Customer interviews, sign-ups, pilots, usage numbers. Changes they made because of what they heard.',
     'Only things built, nothing learned. Friends saying "cool idea" counted as validation.', 4),
    (p_event, 'team', 'Team & Execution',
     'Is this the right team, and are they moving fast?',
     'Relevant skills or insight. Visible progress since the last check-in. Clear ownership.',
     'Missing key skills with no plan to fill them. Little progress since kickoff.', 5),
    (p_event, 'business', 'Business Model',
     'Who pays, how much, and why would they?',
     'A specific price and buyer. Some evidence someone would actually pay.',
     '"We''ll figure out monetization later." Revenue that depends on huge scale.', 6),
    (p_event, 'honesty', 'Honesty & Risks',
     'Do they say what they don''t know yet and how they''ll find out?',
     'Names the biggest risks plainly. A concrete plan to test them next.',
     'Everything is perfect. Dodging hard questions. Numbers that don''t add up.', 7);

  update invest_rubric_pillars p
  set partner_prompt = d.prompt,
      partner_strong_signals = d.strong,
      partner_red_flags = d.red
  from invest_default_partner_text() d
  where p.event_id = p_event and p.key = d.key;
end;
$$;

-- Cloning an event copies tracks and partner wording.
create or replace function invest_create_event(
  p_user text,
  p_name text,
  p_slug text,
  p_starting_capital integer default 200000,
  p_clone_from uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_event uuid;
begin
  if not is_admin(p_user) then
    raise exception 'Admins only';
  end if;

  insert into events (tool, name, slug, starting_capital, created_by)
  values ('invest', trim(p_name), lower(trim(p_slug)), p_starting_capital, p_user)
  returning id into v_event;

  if p_clone_from is null then
    perform invest_insert_default_pillars(v_event);
  else
    insert into invest_rubric_pillars
      (event_id, key, label, prompt, strong_signals, red_flags,
       partner_prompt, partner_strong_signals, partner_red_flags, sort_order)
    select v_event, key, label, prompt, strong_signals, red_flags,
           partner_prompt, partner_strong_signals, partner_red_flags, sort_order
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

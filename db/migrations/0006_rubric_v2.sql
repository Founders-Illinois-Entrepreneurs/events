-- Rubric v2: the rubric is the basis for how much each table invests.
--   * Each pillar gets a "listen for" checklist (one item per line), a 1/3/5
--     score guide (weak_signals = 1, partial_signals = 3, strong_signals = 5),
--     an optional note, and a weight.
--   * A team's rubric score is the weighted average of its pillar scores. It
--     breaks ties and drives each table's suggested split.
--   * New events get the new seven-pillar default. Existing events keep their
--     rubric (weight 1 everywhere, so their results don't change).

alter table invest_rubric_pillars
  add column listen_for          text not null default '',
  add column weak_signals        text not null default '',
  add column partial_signals     text not null default '',
  add column note                text not null default '',
  add column weight              numeric(3, 1) not null default 1 check (weight > 0 and weight <= 5),
  add column partner_listen_for  text not null default '';

-- The default rubric, in pitch order. Lists are one item per line.
create or replace function invest_insert_default_pillars(p_event uuid)
returns void
language plpgsql
as $$
begin
  insert into invest_rubric_pillars
    (event_id, sort_order, key, label, weight, prompt, note, listen_for,
     weak_signals, partial_signals, strong_signals, red_flags, partner_prompt, partner_listen_for)
  values
    (p_event, 1, 'problem', 'Problem', 1,
     'Is this a real, painful problem, and how big is it?',
     '',
     E'What does the problem cost the builders themselves? Time, money, annoyance.\n'
     'Who else has it, and how big is it? How many people, how many hours a week, how much money.\n'
     'How is the problem handled today? The current tool, workaround, or “just live with it”.',
     'A vague or invented problem. No sense of who has it or what it costs.',
     'A real problem the team has felt, but its size is a guess and today’s workarounds are barely covered.',
     'Pain measured in hours, dollars or frequency for a specific group, plus a clear picture of how people cope today and why that falls short.',
     E'“Everyone has this problem.”\nOnly the founders’ own opinion\nA solution looking for a problem',
     'Does the team understand the partner’s problem and what it costs them?',
     E'What does the problem cost the partner startup? Time, money, lost customers.\n'
     'Who at the partner feels it most, and how often?\n'
     'How was the partner handling it before the team got involved?'),

    (p_event, 2, 'customer', 'Customer & Market', 1,
     'Who exactly is the customer, and does the team really know them?',
     '',
     E'An ideal customer profile that is very specific. “Students” is too broad; “first-year engineering students who commute and work part-time” is the level of detail to look for.\n'
     'Who makes the decision? Is the person using it the same person who pays for it?\n'
     'How many of these customers has the team talked to, and what did they learn?\n'
     'A customer story: can they walk you through one target user’s day, as a real anecdote?',
     '“Our market is everyone.” No customer conversations.',
     'A rough customer group and a few conversations, but no clear buyer and no concrete insight.',
     'A sharp customer profile, a clear user and buyer, many conversations with specific insights, and a story that makes the customer feel real.',
     E'Big top-down market numbers with no first customer\nMixing up the user and the buyer\nTalking about “users” with no real person behind it',
     'Who are the partner’s customers, and how does the team’s work reach them?',
     E'Who buys from the partner, and who makes that decision?\n'
     'Has the team talked to the partner’s customers directly? What did they learn?\n'
     'Can they tell the story of one of the partner’s customers and where their work shows up?'),

    (p_event, 3, 'solution', 'Solution', 1,
     'What would the world need to fix this problem, no matter who builds it?',
     '',
     E'The ideal answer, said plainly: “We need a ___ that does ___, ___ and ___.”\n'
     'Does it follow from the problem and customer they just described?\n'
     'Is it the simplest thing that would remove the pain?',
     'Jumps straight to an app or a technology. No idea of what a good solution has to do.',
     'Names what’s needed, but loosely, or it only partly matches the problem.',
     'A crisp “we need a ___ that does ___” that clearly comes from the problem and customer.',
     E'Opens with “we built an app”\nA trendy technology with no reason it’s needed\nSolves a different problem than the one they described',
     'What does the partner need to fix this, ideally?',
     E'What would solve the partner’s problem, whoever built it?\n'
     'Did the team choose the right thing to work on, or only what they were asked to do?'),

    (p_event, 4, 'product', 'Product', 1,
     'What are they building, and why is it better than the alternatives?',
     '',
     E'What the product is and its key traits, in a sentence or two.\n'
     'Who the competitors are, including “do nothing” and spreadsheets.\n'
     'What sets them apart, and the gap in the market nobody covers yet.\n'
     'A demo, prototype, concept or user storyboard: how a user actually interacts with it and benefits.',
     'Only an idea. No picture of how anyone would use it, and competitors are ignored.',
     'A concept or early prototype and a list of competitors, but what makes them different is vague.',
     'A working demo or clear storyboard of a real user, and a sharp reason it beats what exists today.',
     E'“We have no competitors.”\nA feature list with no link to the problem\nA demo that never shows the user getting the benefit',
     'What has the team built or delivered for the partner, and is it the right thing?',
     E'What have they shipped for the partner so far?\n'
     'Can they show it? A demo, the shipped work, or a before-and-after.\n'
     'Is the partner actually using it, and what sets it apart from what the partner had before?'),

    (p_event, 5, 'business', 'Business Model', 0.5,
     'If it applies yet: who pays, how much, and why?',
     'Early teams shouldn’t spend much of their pitch here. Reward clear thinking about price; don’t punish a model that isn’t finished.',
     E'Who pays, if anyone yet?\n'
     'How the price is set: by what it costs to make, by the value it adds for users, or by what competitors charge.\n'
     'Any sign someone would actually pay that price.',
     'No idea who would pay or why.',
     'A believable payer and a rough price.',
     'A specific price tied to the value users get, and a hint that someone would pay it.',
     E'Revenue that only works at huge scale\nA five-year revenue chart with no first customer',
     'How does the team’s work create value for the partner’s business?',
     E'Does the work make or save the partner money, or help it grow?\n'
     'Can they put a rough number on it?'),

    (p_event, 6, 'traction', 'Traction & Validation', 1.5,
     'What have they learned from real customers since kickoff?',
     'This pillar is about actual customer discovery: real conversations with the people in their customer profile.',
     E'How many real customer conversations they’ve had, and with whom.\n'
     'What surprised them, and what they changed because of it.\n'
     'Commitments such as sign-ups, pilots, pre-orders or letters of intent. Compliments don’t count.\n'
     'Usage numbers, if anything is live.',
     'Built things, but talked to no one.',
     'Some conversations, mostly with friends or people who said “cool idea”. Little changed because of them.',
     'Many conversations with target customers, clear lessons, changes made because of them, and early commitments.',
     E'Friends saying “cool idea” counted as validation\nSurveys only, no conversations\nNothing changed since kickoff',
     'What evidence shows the team’s work is helping the partner?',
     E'What feedback has the partner given on the work?\n'
     'Did anything move: metrics, decisions or usage at the partner?\n'
     'Has the team talked to the partner’s customers, not only the partner?'),

    (p_event, 7, 'pitch', 'Pitch Execution', 1,
     'Did they tell a clear story and handle questions well?',
     '',
     E'A clear story from problem to product to what’s next, inside the time limit.\n'
     'Slides and demo that help rather than distract.\n'
     'Direct answers in Q&A, including “we don’t know yet, and here’s how we’ll find out”.\n'
     'The whole team knows the material.',
     'Hard to follow, over time, or dodged questions.',
     'Clear enough, with a few gaps or rushed parts.',
     'Easy to follow, on time, and handled tough questions honestly.',
     E'Reading slides word for word\nDodging hard questions\nNumbers that don’t add up',
     '',
     '');
end;
$$;

-- The old default partner wording is no longer used.
drop function invest_default_partner_text();

-- Copying an event copies the whole rubric, including checklists, score guides and weights.
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
       listen_for, weak_signals, partial_signals, note, weight, partner_listen_for)
    select v_event, key, label, prompt, strong_signals, red_flags,
           partner_prompt, partner_strong_signals, partner_red_flags, sort_order,
           listen_for, weak_signals, partial_signals, note, weight, partner_listen_for
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

-- Results: a team's rubric score (avg_score) is now the weighted average of its pillar scores.
create or replace function invest_results(p_event uuid, p_as_admin boolean default false)
returns jsonb
language plpgsql
stable
as $$
declare
  v_event events;
begin
  select * into v_event from events where id = p_event;
  if v_event.id is null then
    raise exception 'Event not found';
  end if;
  if not (p_as_admin or v_event.status = 'revealed') then
    raise exception 'Results are not revealed yet';
  end if;

  return jsonb_build_object(
    'event', jsonb_build_object(
      'id', v_event.id, 'name', v_event.name, 'status', v_event.status,
      'starting_capital', v_event.starting_capital, 'reveal_names', v_event.reveal_names
    ),
    'submitted_teams', (select count(*) from invest_submissions where event_id = p_event),
    'pillars', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'key', key, 'label', label) order by sort_order)
      from invest_rubric_pillars where event_id = p_event
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(t order by (t ->> 'rank')::int)
      from (
        select jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'one_liner', p.one_liner,
          'track', p.track,
          'total', totals.total,
          'avg_score', totals.avg_score,
          'rank', rank() over (order by totals.total desc, totals.avg_score desc nulls last),
          'pillar_avgs', coalesce((
            select jsonb_object_agg(r.key, r.avg)
            from (
              select pl.key, round(avg(s.score)::numeric, 2) as avg
              from invest_rubric_pillars pl
              join invest_rubric_scores s on s.pillar_id = pl.id and s.presenter_team_id = p.id
              join invest_submissions sub on sub.investor_team_id = s.investor_team_id
              group by pl.key
            ) r
          ), '{}'::jsonb),
          'feedback', coalesce((
            select jsonb_agg(jsonb_build_object(
              'investor', case when v_event.reveal_names or p_as_admin then it.name end,
              'amount', a.amount,
              'rationale', a.rationale,
              'invest_more_if', a.invest_more_if,
              'starred', sub.starred,
              'auto', sub.submitted_by is null
            ) order by a.amount desc)
            from invest_allocations a
            join invest_submissions sub on sub.investor_team_id = a.investor_team_id
            join invest_investor_teams it on it.id = a.investor_team_id
            where a.presenter_team_id = p.id
          ), '[]'::jsonb)
        ) as t
        from invest_presenter_teams p
        cross join lateral (
          select
            coalesce((
              select sum(a.amount)
              from invest_allocations a
              join invest_submissions sub on sub.investor_team_id = a.investor_team_id
              where a.presenter_team_id = p.id
            ), 0)::bigint as total,
            (
              select round(sum(s.score * pl.weight) / nullif(sum(pl.weight), 0), 2)
              from invest_rubric_scores s
              join invest_rubric_pillars pl on pl.id = s.pillar_id
              join invest_submissions sub on sub.investor_team_id = s.investor_team_id
              where s.presenter_team_id = p.id
            ) as avg_score
        ) totals
        where p.event_id = p_event
      ) ranked(t)
    ), '[]'::jsonb),
    'starred', coalesce((
      select jsonb_agg(jsonb_build_object(
        'investor', case when v_event.reveal_names or p_as_admin then it.name end,
        'allocations', (
          select jsonb_agg(jsonb_build_object('team', p.name, 'amount', a.amount, 'rationale', a.rationale)
                           order by a.amount desc)
          from invest_allocations a
          join invest_presenter_teams p on p.id = a.presenter_team_id
          where a.investor_team_id = sub.investor_team_id
        )
      ))
      from invest_submissions sub
      join invest_investor_teams it on it.id = sub.investor_team_id
      where sub.event_id = p_event and sub.starred
    ), '[]'::jsonb)
  );
end;
$$;

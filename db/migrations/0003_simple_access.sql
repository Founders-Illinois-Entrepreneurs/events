-- Simpler access: no Google / email accounts.
--   * Members type their name when they join an event. Their browser keeps a
--     random token (cookie); only its SHA-256 hash is stored here.
--   * Organizers sign in with one shared ADMIN_PASSWORD (checked in the app).
-- Admin checks now live in the app (lib/auth.ts); the database functions
-- enforce the game rules.

create table members (
  id          text primary key,
  name        text not null check (length(trim(name)) between 1 and 60),
  token_hash  text not null unique,
  created_at  timestamptz not null default now()
);

-- Point everything that referenced a Google account at members instead.
alter table invest_team_members drop constraint invest_team_members_user_id_fkey;
alter table invest_team_members
  add constraint invest_team_members_user_id_fkey foreign key (user_id) references members (id) on delete cascade;

alter table invest_allocations drop constraint invest_allocations_updated_by_fkey;
alter table invest_allocations
  add constraint invest_allocations_updated_by_fkey foreign key (updated_by) references members (id) on delete set null;

alter table invest_rubric_scores drop constraint invest_rubric_scores_updated_by_fkey;
alter table invest_rubric_scores
  add constraint invest_rubric_scores_updated_by_fkey foreign key (updated_by) references members (id) on delete set null;

alter table invest_submissions drop constraint invest_submissions_submitted_by_fkey;
alter table invest_submissions
  add constraint invest_submissions_submitted_by_fkey foreign key (submitted_by) references members (id) on delete set null;

alter table events drop column created_by;

-- Functions whose admin check moves into the app.
drop function set_admin(text, text, boolean);
drop function invest_create_event(text, text, text, integer, uuid);
drop function invest_results(text, uuid);
drop function is_admin(text);

-- Remove the Google sign-in tables.
drop table verification;
drop table account;
drop table session;
drop table "user";
drop function check_user_email();
drop function is_allowed_email(text);

-- Organizers: create an event, optionally copying setup (pillars, teams) from a past one.
create or replace function invest_create_event(
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
  insert into events (tool, name, slug, starting_capital)
  values ('invest', trim(p_name), lower(trim(p_slug)), p_starting_capital)
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

-- Results: totals, rubric averages, and feedback per presenter team.
-- Organizers (p_as_admin) can see them any time; everyone else only after the reveal.
-- Investor team names are included only when the event's reveal_names is on.
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
              'investor', case when v_event.reveal_names then it.name end,
              'amount', a.amount,
              'rationale', a.rationale,
              'invest_more_if', a.invest_more_if,
              'starred', sub.starred
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
              select round(avg(s.score)::numeric, 2)
              from invest_rubric_scores s
              join invest_submissions sub on sub.investor_team_id = s.investor_team_id
              where s.presenter_team_id = p.id
            ) as avg_score
        ) totals
        where p.event_id = p_event
      ) ranked(t)
    ), '[]'::jsonb),
    'starred', coalesce((
      select jsonb_agg(jsonb_build_object(
        'investor', case when v_event.reveal_names then it.name end,
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

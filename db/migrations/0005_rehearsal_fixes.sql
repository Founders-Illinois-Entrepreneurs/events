-- Fixes from the event-night rehearsal.

-- A phone can only leave its table before the table has entered anything
-- (otherwise answers would be stranded on a table nobody is signed in to).
create or replace function invest_leave_team(p_user text, p_event uuid)
returns void
language plpgsql
as $$
declare
  v_team uuid;
begin
  select investor_team_id into v_team
  from invest_team_members
  where event_id = p_event and user_id = p_user;

  if v_team is null then
    return;
  end if;
  if exists (select 1 from invest_submissions where investor_team_id = v_team) then
    raise exception 'Your table already submitted, so you can''t leave';
  end if;
  if exists (select 1 from invest_allocations where investor_team_id = v_team)
     or exists (select 1 from invest_rubric_scores where investor_team_id = v_team) then
    raise exception 'Your table has already started answering. Ask an organizer if you need to move.';
  end if;
  if (select status from events where id = p_event) not in ('setup', 'open') then
    raise exception 'Tables are locked for this event';
  end if;

  delete from invest_team_members where event_id = p_event and user_id = p_user;
end;
$$;

-- Organizers always see which table wrote what (members only when reveal_names is on),
-- and feedback marks tables that were auto-submitted at close.
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

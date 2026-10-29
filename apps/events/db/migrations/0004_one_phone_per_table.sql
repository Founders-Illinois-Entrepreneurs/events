-- One phone per table: each investor table signs in on a single device and
-- fills its portfolio together. (Shared editing across phones caused
-- teammates to overwrite each other.) The "member" row now represents that
-- device, and its name holds the names of everyone at the table.

alter table members drop constraint members_name_check;
alter table members add constraint members_name_check check (length(trim(name)) between 1 and 120);

-- Join (or switch to) a table. A table belongs to the first phone that joins it.
create or replace function invest_join_team(p_user text, p_team uuid)
returns void
language plpgsql
as $$
declare
  v_event   uuid;
  v_status  event_status;
  v_current uuid;
begin
  select t.event_id, e.status
    into v_event, v_status
  from invest_investor_teams t
  join events e on e.id = t.event_id
  where t.id = p_team
  for update of t;

  if v_event is null then
    raise exception 'Table not found';
  end if;
  if v_status not in ('setup', 'open') then
    raise exception 'Tables are locked for this event';
  end if;

  select investor_team_id into v_current
  from invest_team_members
  where event_id = v_event and user_id = p_user;

  if v_current = p_team then
    return;
  end if;
  if v_current is not null and exists (select 1 from invest_submissions where investor_team_id = v_current) then
    raise exception 'Your table already submitted, so you can''t switch';
  end if;
  if exists (select 1 from invest_submissions where investor_team_id = p_team) then
    raise exception 'That table already submitted';
  end if;
  if exists (select 1 from invest_team_members where investor_team_id = p_team and user_id <> p_user) then
    raise exception 'Another phone is already signed in for that table. Use that phone, or ask an organizer to free the table.';
  end if;

  delete from invest_team_members where event_id = v_event and user_id = p_user;
  insert into invest_team_members (event_id, investor_team_id, user_id) values (v_event, p_team, p_user);
end;
$$;

-- What (if anything) stops this table's portfolio from being submitted. NULL = ready.
create or replace function invest_portfolio_problem(p_team uuid)
returns text
language plpgsql
stable
as $$
declare
  v_event    uuid;
  v_capital  integer;
  v_pillars  integer;
  v_total    bigint;
  v_missing  text;
begin
  select e.id, e.starting_capital into v_event, v_capital
  from invest_investor_teams t join events e on e.id = t.event_id
  where t.id = p_team;

  if not exists (select 1 from invest_presenter_teams where event_id = v_event) then
    return 'There are no R&D teams to invest in yet';
  end if;

  select count(*) into v_pillars from invest_rubric_pillars where event_id = v_event;

  select string_agg(p.name, ', ' order by p.sort_order, p.name) into v_missing
  from invest_presenter_teams p
  left join invest_allocations a
    on a.presenter_team_id = p.id and a.investor_team_id = p_team
  where p.event_id = v_event
    and (
      a.presenter_team_id is null
      or length(trim(a.rationale)) = 0
      or length(trim(a.invest_more_if)) = 0
      or (
        select count(*) from invest_rubric_scores s
        where s.investor_team_id = p_team and s.presenter_team_id = p.id
      ) < v_pillars
    );
  if v_missing is not null then
    return format('Finish every field for: %s', v_missing);
  end if;

  select coalesce(sum(amount), 0) into v_total from invest_allocations where investor_team_id = p_team;
  if v_total <> v_capital then
    return format('You must invest exactly $%s (you have $%s allocated)', v_capital, v_total);
  end if;

  return null;
end;
$$;

create or replace function invest_submit(p_user text, p_team uuid)
returns void
language plpgsql
as $$
declare
  v_event    uuid;
  v_status   event_status;
  v_problem  text;
begin
  if not invest_is_team_member(p_user, p_team) then
    raise exception 'You are not on this table';
  end if;

  select e.id, e.status into v_event, v_status
  from invest_investor_teams t join events e on e.id = t.event_id
  where t.id = p_team
  for update of t;

  if v_status <> 'open' then
    raise exception 'Investing is not open';
  end if;
  if exists (select 1 from invest_submissions where investor_team_id = p_team) then
    raise exception 'Your table already submitted';
  end if;

  v_problem := invest_portfolio_problem(p_team);
  if v_problem is not null then
    raise exception '%', v_problem;
  end if;

  insert into invest_submissions (investor_team_id, event_id, submitted_by)
  values (p_team, v_event, p_user);
end;
$$;

-- Close investing. Tables whose portfolio is complete but who forgot to press
-- Submit are submitted automatically, so their work isn't lost.
-- Returns how many tables were auto-submitted.
create or replace function invest_close_event(p_event uuid)
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  update events set status = 'closed' where id = p_event;

  insert into invest_submissions (investor_team_id, event_id, submitted_by)
  select t.id, t.event_id, null
  from invest_investor_teams t
  where t.event_id = p_event
    and not exists (select 1 from invest_submissions s where s.investor_team_id = t.id)
    and exists (select 1 from invest_allocations a where a.investor_team_id = t.id)
    and invest_portfolio_problem(t.id) is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Copying an event keeps the original's capital unless a new amount is given.
drop function invest_create_event(text, text, integer, uuid);
create function invest_create_event(
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

-- Join page: which tables are free. Natural order, so "Table 2" comes before "Table 10".
drop function invest_team_counts(uuid);
create function invest_team_counts(p_event uuid)
returns table (id uuid, name text, taken boolean, submitted boolean)
language sql
stable
as $$
  select t.id, t.name,
         exists (select 1 from invest_team_members m where m.investor_team_id = t.id),
         exists (select 1 from invest_submissions s where s.investor_team_id = t.id)
  from invest_investor_teams t
  where t.event_id = p_event
  order by length(t.name), t.name
$$;

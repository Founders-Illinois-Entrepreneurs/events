-- Founders Tools database (plain Postgres; hosted on Neon).
--
-- Only the Next.js server talks to this database (DATABASE_URL never reaches
-- the browser). Who-can-do-what is checked in two places:
--   * the server code (lib/auth.ts: requireProfile / requireAdmin), and
--   * the game-rule functions below, which take the acting user's id and
--     refuse anything that breaks the rules.

-- ---------------------------------------------------------------------------
-- Sign-in (tables used by Better Auth, plus our isAdmin flag)
-- ---------------------------------------------------------------------------

-- Only university accounts may sign in. Change the domain here (and in
-- NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN) if another school ever reuses this.
create or replace function is_allowed_email(p_email text)
returns boolean
language sql
immutable
as $$
  select coalesce(lower(p_email) like '%@illinois.edu', false)
$$;

create table "user" (
  id              text primary key,
  name            text not null,
  email           text not null unique,
  "emailVerified" boolean not null default false,
  image           text,
  "isAdmin"       boolean not null default false,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now()
);

create table session (
  id           text primary key,
  "expiresAt"  timestamptz not null,
  token        text not null unique,
  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now(),
  "ipAddress"  text,
  "userAgent"  text,
  "userId"     text not null references "user" (id) on delete cascade
);
create index on session ("userId");

create table account (
  id                       text primary key,
  "accountId"              text not null,
  "providerId"             text not null,
  "userId"                 text not null references "user" (id) on delete cascade,
  "accessToken"            text,
  "refreshToken"           text,
  "idToken"                text,
  "accessTokenExpiresAt"   timestamptz,
  "refreshTokenExpiresAt"  timestamptz,
  scope                    text,
  password                 text,
  "createdAt"              timestamptz not null default now(),
  "updatedAt"              timestamptz not null default now()
);
create index on account ("userId");

create table verification (
  id           text primary key,
  identifier   text not null,
  value        text not null,
  "expiresAt"  timestamptz not null,
  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now()
);
create index on verification (identifier);

-- Last line of defense: the database itself refuses non-university accounts.
create or replace function check_user_email()
returns trigger
language plpgsql
as $$
begin
  if not is_allowed_email(new.email) then
    raise exception 'Only @illinois.edu accounts can sign in';
  end if;
  return new;
end;
$$;

create trigger check_user_email
  before insert or update of email on "user"
  for each row execute function check_user_email();

create or replace function is_admin(p_user text)
returns boolean
language sql
stable
as $$
  select coalesce((select "isAdmin" from "user" where id = p_user), false)
$$;

-- ---------------------------------------------------------------------------
-- Events (one row per run of any tool, kept forever as history)
-- ---------------------------------------------------------------------------

create type event_status as enum ('setup', 'open', 'closed', 'revealed');

create table events (
  id                uuid primary key default gen_random_uuid(),
  tool              text not null default 'invest' check (tool in ('invest')),
  name              text not null check (length(trim(name)) > 0),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status            event_status not null default 'setup',
  starting_capital  integer not null default 200000 check (starting_capital > 0),
  reveal_names      boolean not null default false, -- show investor team names next to feedback
  archived          boolean not null default false,
  created_by        text references "user" (id) on delete set null,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Investment game
-- ---------------------------------------------------------------------------

create table invest_presenter_teams (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  one_liner   text not null default '',
  description text not null default '',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (id, event_id)
);

create table invest_investor_teams (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  max_members integer not null default 3 check (max_members between 1 and 20),
  created_at  timestamptz not null default now(),
  unique (id, event_id),
  unique (event_id, name)
);

create table invest_team_members (
  event_id          uuid not null references events (id) on delete cascade,
  investor_team_id  uuid not null,
  user_id           text not null references "user" (id) on delete cascade,
  joined_at         timestamptz not null default now(),
  primary key (event_id, user_id),
  foreign key (investor_team_id, event_id)
    references invest_investor_teams (id, event_id) on delete cascade
);
create index on invest_team_members (investor_team_id);

create table invest_rubric_pillars (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events (id) on delete cascade,
  key             text not null,
  label           text not null,
  prompt          text not null default '',
  strong_signals  text not null default '',
  red_flags       text not null default '',
  sort_order      integer not null default 0,
  unique (event_id, key),
  unique (id, event_id)
);

create table invest_allocations (
  event_id           uuid not null,
  investor_team_id   uuid not null,
  presenter_team_id  uuid not null,
  amount             integer not null default 0 check (amount >= 0),
  rationale          text not null default '',
  invest_more_if     text not null default '',
  updated_by         text references "user" (id) on delete set null,
  updated_at         timestamptz not null default now(),
  primary key (investor_team_id, presenter_team_id),
  foreign key (investor_team_id, event_id)
    references invest_investor_teams (id, event_id) on delete cascade,
  foreign key (presenter_team_id, event_id)
    references invest_presenter_teams (id, event_id) on delete cascade
);

create table invest_rubric_scores (
  event_id           uuid not null,
  investor_team_id   uuid not null,
  presenter_team_id  uuid not null,
  pillar_id          uuid not null,
  score              smallint not null check (score between 1 and 5),
  updated_by         text references "user" (id) on delete set null,
  updated_at         timestamptz not null default now(),
  primary key (investor_team_id, presenter_team_id, pillar_id),
  foreign key (investor_team_id, event_id)
    references invest_investor_teams (id, event_id) on delete cascade,
  foreign key (presenter_team_id, event_id)
    references invest_presenter_teams (id, event_id) on delete cascade,
  foreign key (pillar_id, event_id)
    references invest_rubric_pillars (id, event_id) on delete cascade
);

create table invest_submissions (
  investor_team_id  uuid primary key,
  event_id          uuid not null,
  submitted_by      text references "user" (id) on delete set null,
  submitted_at      timestamptz not null default now(),
  starred           boolean not null default false, -- "Best Investor Thesis"
  foreign key (investor_team_id, event_id)
    references invest_investor_teams (id, event_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Rule helpers
-- ---------------------------------------------------------------------------

create or replace function invest_is_team_member(p_user text, p_team uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from invest_team_members where investor_team_id = p_team and user_id = p_user
  )
$$;

-- True when this user may still edit this investor team's portfolio.
create or replace function invest_team_can_edit(p_user text, p_team uuid)
returns boolean
language sql
stable
as $$
  select invest_is_team_member(p_user, p_team)
    and exists (
      select 1
      from invest_investor_teams t
      join events e on e.id = t.event_id
      where t.id = p_team and e.status = 'open'
    )
    and not exists (select 1 from invest_submissions s where s.investor_team_id = p_team)
$$;

-- ---------------------------------------------------------------------------
-- Default rubric (the teaching content). Edit per event in the admin page.
-- ---------------------------------------------------------------------------

create or replace function invest_insert_default_pillars(p_event uuid)
returns void
language sql
as $$
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
     'Everything is perfect. Dodging hard questions. Numbers that don''t add up.', 7)
$$;

-- ---------------------------------------------------------------------------
-- Actions (each takes the acting user's id and enforces the rules)
-- ---------------------------------------------------------------------------

-- Admin: create an event, optionally copying setup (pillars, teams) from a past one.
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
    insert into invest_rubric_pillars (event_id, key, label, prompt, strong_signals, red_flags, sort_order)
    select v_event, key, label, prompt, strong_signals, red_flags, sort_order
    from invest_rubric_pillars where event_id = p_clone_from;

    insert into invest_presenter_teams (event_id, name, one_liner, description, sort_order)
    select v_event, name, one_liner, description, sort_order
    from invest_presenter_teams where event_id = p_clone_from;

    insert into invest_investor_teams (event_id, name, max_members)
    select v_event, name, max_members
    from invest_investor_teams where event_id = p_clone_from;
  end if;

  return v_event;
end;
$$;

-- Member: join (or switch to) an investor team. Not allowed once your team has submitted.
create or replace function invest_join_team(p_user text, p_team uuid)
returns void
language plpgsql
as $$
declare
  v_event   uuid;
  v_status  event_status;
  v_max     integer;
  v_current uuid;
begin
  select t.event_id, e.status, t.max_members
    into v_event, v_status, v_max
  from invest_investor_teams t
  join events e on e.id = t.event_id
  where t.id = p_team
  for update of t;

  if v_event is null then
    raise exception 'Team not found';
  end if;
  if v_status not in ('setup', 'open') then
    raise exception 'Teams are locked for this event';
  end if;

  select investor_team_id into v_current
  from invest_team_members
  where event_id = v_event and user_id = p_user;

  if v_current = p_team then
    return;
  end if;
  if v_current is not null and exists (select 1 from invest_submissions where investor_team_id = v_current) then
    raise exception 'Your team already submitted, so you can''t switch';
  end if;
  if exists (select 1 from invest_submissions where investor_team_id = p_team) then
    raise exception 'That team already submitted';
  end if;
  if (select count(*) from invest_team_members where investor_team_id = p_team) >= v_max then
    raise exception 'That team is full';
  end if;

  delete from invest_team_members where event_id = v_event and user_id = p_user;
  insert into invest_team_members (event_id, investor_team_id, user_id) values (v_event, p_team, p_user);
end;
$$;

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
    raise exception 'Your team already submitted, so you can''t leave';
  end if;
  if (select status from events where id = p_event) not in ('setup', 'open') then
    raise exception 'Teams are locked for this event';
  end if;

  delete from invest_team_members where event_id = p_event and user_id = p_user;
end;
$$;

-- Member: save one card of the team's portfolio (autosave).
create or replace function invest_save_allocation(
  p_user text,
  p_team uuid,
  p_presenter uuid,
  p_amount integer,
  p_rationale text,
  p_invest_more_if text
)
returns void
language plpgsql
as $$
begin
  if not invest_team_can_edit(p_user, p_team) then
    raise exception 'Your team can''t edit its portfolio right now';
  end if;

  insert into invest_allocations
    (event_id, investor_team_id, presenter_team_id, amount, rationale, invest_more_if, updated_by, updated_at)
  select t.event_id, p_team, p_presenter, p_amount, coalesce(p_rationale, ''), coalesce(p_invest_more_if, ''), p_user, now()
  from invest_investor_teams t where t.id = p_team
  on conflict (investor_team_id, presenter_team_id) do update
    set amount = excluded.amount,
        rationale = excluded.rationale,
        invest_more_if = excluded.invest_more_if,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;
end;
$$;

-- Member: save one rubric score (autosave).
create or replace function invest_save_score(
  p_user text,
  p_team uuid,
  p_presenter uuid,
  p_pillar uuid,
  p_score integer
)
returns void
language plpgsql
as $$
begin
  if not invest_team_can_edit(p_user, p_team) then
    raise exception 'Your team can''t edit its portfolio right now';
  end if;

  insert into invest_rubric_scores
    (event_id, investor_team_id, presenter_team_id, pillar_id, score, updated_by, updated_at)
  select t.event_id, p_team, p_presenter, p_pillar, p_score, p_user, now()
  from invest_investor_teams t where t.id = p_team
  on conflict (investor_team_id, presenter_team_id, pillar_id) do update
    set score = excluded.score,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;
end;
$$;

-- Member: lock in the team's portfolio. All game rules are checked here.
create or replace function invest_submit(p_user text, p_team uuid)
returns void
language plpgsql
as $$
declare
  v_event    uuid;
  v_status   event_status;
  v_capital  integer;
  v_pillars  integer;
  v_total    bigint;
  v_missing  text;
begin
  if not invest_is_team_member(p_user, p_team) then
    raise exception 'You are not on this team';
  end if;

  select e.id, e.status, e.starting_capital
    into v_event, v_status, v_capital
  from invest_investor_teams t
  join events e on e.id = t.event_id
  where t.id = p_team;

  if v_status <> 'open' then
    raise exception 'Investing is not open';
  end if;
  if exists (select 1 from invest_submissions where investor_team_id = p_team) then
    raise exception 'Your team already submitted';
  end if;

  select count(*) into v_pillars from invest_rubric_pillars where event_id = v_event;

  -- Every presenter team needs an amount, a reason, an "invest more if", and every score.
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
    raise exception 'Finish every field for: %', v_missing;
  end if;

  select coalesce(sum(amount), 0) into v_total
  from invest_allocations where investor_team_id = p_team;

  if v_total <> v_capital then
    raise exception 'You must invest exactly $% (you have $% allocated)', v_capital, v_total;
  end if;

  insert into invest_submissions (investor_team_id, event_id, submitted_by)
  values (p_team, v_event, p_user);
end;
$$;

-- Join page: team sizes without exposing who is on other teams.
create or replace function invest_team_counts(p_event uuid)
returns table (id uuid, name text, max_members integer, member_count integer, submitted boolean)
language sql
stable
as $$
  select t.id, t.name, t.max_members,
         (select count(*)::int from invest_team_members m where m.investor_team_id = t.id),
         exists (select 1 from invest_submissions s where s.investor_team_id = t.id)
  from invest_investor_teams t
  where t.event_id = p_event
  order by t.name
$$;

-- Results: totals, rubric averages, and feedback per presenter team.
-- Admins can see them any time; everyone else only after the reveal.
-- Investor team names are included only when the event's reveal_names is on.
create or replace function invest_results(p_user text, p_event uuid)
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
  if not (is_admin(p_user) or v_event.status = 'revealed') then
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

-- Admin: grant or remove admin by email (the person must have signed in once).
create or replace function set_admin(p_actor text, p_email text, p_is_admin boolean)
returns void
language plpgsql
as $$
declare
  v_target text;
begin
  if not is_admin(p_actor) then
    raise exception 'Admins only';
  end if;
  select id into v_target from "user" where lower(email) = lower(trim(p_email));
  if v_target is null then
    raise exception 'No one with that email has signed in yet';
  end if;
  if v_target = p_actor and not p_is_admin then
    raise exception 'You cannot remove your own admin access';
  end if;
  update "user" set "isAdmin" = p_is_admin, "updatedAt" = now() where id = v_target;
end;
$$;

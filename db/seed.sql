-- Demo data for local development only. No real member data belongs here.
do $$
declare
  v_event uuid;
begin
  insert into events (tool, name, slug, status, starting_capital)
  values ('invest', 'R&D Midpoint Evaluation (demo)', 'demo-midpoint', 'setup', 200000)
  on conflict (slug) do nothing
  returning id into v_event;

  if v_event is null then
    return; -- already seeded
  end if;

  perform invest_insert_default_pillars(v_event);

  insert into invest_presenter_teams (event_id, name, one_liner, sort_order) values
    (v_event, 'Team Alpha', 'Demo presenter team', 1),
    (v_event, 'Team Beta',  'Demo presenter team', 2),
    (v_event, 'Team Gamma', 'Demo team working with an existing startup', 3);

  update invest_presenter_teams set track = 'partner' where event_id = v_event and name = 'Team Gamma';

  insert into invest_investor_teams (event_id, name, max_members) values
    (v_event, 'Investors 1', 3), (v_event, 'Investors 2', 3),
    (v_event, 'Investors 3', 3), (v_event, 'Investors 4', 3);
end $$;

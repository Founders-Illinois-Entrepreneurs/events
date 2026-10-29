-- "Reset event": a fresh restart after a practice run or a mistake.
-- Removes everything people did (table sign-ins, answers, scores, submissions,
-- stars), restores the default rubric, and puts the event back in Setup.
-- Keeps the event itself (name, link, capital) and its R&D teams and tables.
create or replace function invest_reset_event(p_event uuid)
returns void
language plpgsql
as $$
begin
  -- Lock the event so no phase change or join can interleave with the reset.
  perform 1 from events where id = p_event for update;
  if not found then
    raise exception 'Event not found';
  end if;

  delete from invest_submissions where event_id = p_event;
  delete from invest_rubric_scores where event_id = p_event;
  delete from invest_allocations where event_id = p_event;

  -- Sign phones out of this event's tables, then forget phones that are no
  -- longer signed in anywhere.
  create temp table _reset_members on commit drop as
    select user_id from invest_team_members where event_id = p_event;
  delete from invest_team_members where event_id = p_event;
  delete from members m
  where m.id in (select user_id from _reset_members)
    and not exists (select 1 from invest_team_members t where t.user_id = m.id);

  delete from invest_rubric_pillars where event_id = p_event;
  perform invest_insert_default_pillars(p_event);

  update events set status = 'setup', reveal_names = false where id = p_event;
end;
$$;

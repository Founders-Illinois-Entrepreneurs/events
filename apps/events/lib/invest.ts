import { query, one } from '@/lib/db'
import type {
  Allocation,
  ClubEvent,
  InvestorTeam,
  Pillar,
  PresenterTeam,
  RubricScore,
  Teammate,
} from '@/lib/types'

export async function getEventBySlug(slug: string) {
  return one<ClubEvent>('select * from events where slug = $1', [slug])
}

export async function getPresenters(eventId: string) {
  return query<PresenterTeam>(
    'select * from invest_presenter_teams where event_id = $1 order by sort_order, name',
    [eventId],
  )
}

export async function getPillars(eventId: string) {
  return query<Pillar>('select * from invest_rubric_pillars where event_id = $1 order by sort_order, label', [eventId])
}

export async function getTeamMembers(teamId: string) {
  return query<Teammate>(
    `select mb.id, mb.name
     from invest_team_members m join members mb on mb.id = m.user_id
     where m.investor_team_id = $1 order by m.joined_at`,
    [teamId],
  )
}

// A team's working portfolio. Only call after checking the user is on the team (or is an admin).
export async function getPortfolio(teamId: string) {
  const [allocations, scores, sub] = await Promise.all([
    query<Allocation>('select * from invest_allocations where investor_team_id = $1', [teamId]),
    query<RubricScore>('select * from invest_rubric_scores where investor_team_id = $1', [teamId]),
    one<{ submitted_at: string }>('select submitted_at from invest_submissions where investor_team_id = $1', [teamId]),
  ])
  return { allocations, scores, submittedAt: sub?.submitted_at ?? null }
}

// Everything a member's event page needs.
export async function loadMemberView(slug: string, userId: string | null) {
  const event = await getEventBySlug(slug)
  if (!event) return null

  const [presenters, pillars, team] = await Promise.all([
    getPresenters(event.id),
    getPillars(event.id),
    one<InvestorTeam>(
      `select t.* from invest_team_members m join invest_investor_teams t on t.id = m.investor_team_id
       where m.event_id = $1 and m.user_id = $2`,
      [event.id, userId ?? ''],
    ),
  ])

  let teammates: Teammate[] = []
  let portfolio: Awaited<ReturnType<typeof getPortfolio>> = { allocations: [], scores: [], submittedAt: null }
  if (team) {
    ;[teammates, portfolio] = await Promise.all([getTeamMembers(team.id), getPortfolio(team.id)])
  }

  return { event, presenters, pillars, team, teammates, ...portfolio }
}

// The current (non-archived) event the home page should open.
export async function getCurrentEvents() {
  return query<ClubEvent>(
    `select * from events where not archived
     order by (status = 'revealed'), created_at desc`,
  )
}

export type EventStatus = 'setup' | 'open' | 'closed' | 'revealed'

export type Member = {
  id: string
  name: string
}

export type Teammate = Member

export type ClubEvent = {
  id: string
  tool: 'invest'
  name: string
  slug: string
  status: EventStatus
  starting_capital: number
  reveal_names: boolean
  archived: boolean
  created_at: string
}

export type PresenterTeam = {
  id: string
  event_id: string
  name: string
  one_liner: string
  description: string
  track: Track
  sort_order: number
}

// 'venture' = building their own startup; 'partner' = working with an existing startup
// (consulting / contracting / mentorship). Same pillars, partner-specific wording.
export type Track = 'venture' | 'partner'

export const TRACK_LABEL: Record<Track, string> = {
  venture: 'Own venture',
  partner: 'Startup partner',
}

export type InvestorTeam = {
  id: string
  event_id: string
  name: string
  max_members: number
}

export type Pillar = {
  id: string
  event_id: string
  key: string
  label: string
  prompt: string
  strong_signals: string
  red_flags: string
  partner_prompt: string
  partner_strong_signals: string
  partner_red_flags: string
  sort_order: number
}

// The wording a pillar should show for a given team's track.
export function pillarText(p: Pillar, track: Track) {
  const partner = track === 'partner' && p.partner_prompt.trim() !== ''
  return {
    prompt: partner ? p.partner_prompt : p.prompt,
    strong: partner ? p.partner_strong_signals || p.strong_signals : p.strong_signals,
    red: partner ? p.partner_red_flags || p.red_flags : p.red_flags,
  }
}

export type Allocation = {
  event_id: string
  investor_team_id: string
  presenter_team_id: string
  amount: number
  rationale: string
  invest_more_if: string
  updated_by: string | null
  updated_at: string
}

export type RubricScore = {
  event_id: string
  investor_team_id: string
  presenter_team_id: string
  pillar_id: string
  score: number
  updated_by: string | null
}

export type TeamCount = {
  id: string
  name: string
  max_members: number
  member_count: number
  submitted: boolean
}

export type Results = {
  event: { id: string; name: string; status: EventStatus; starting_capital: number; reveal_names: boolean }
  submitted_teams: number
  pillars: { id: string; key: string; label: string }[]
  teams: {
    id: string
    name: string
    one_liner: string
    total: number
    avg_score: number | null
    rank: number
    pillar_avgs: Record<string, number>
    feedback: { investor: string | null; amount: number; rationale: string; invest_more_if: string; starred: boolean }[]
  }[]
  starred: { investor: string | null; allocations: { team: string; amount: number; rationale: string }[] }[]
}

export const STATUS_LABEL: Record<EventStatus, string> = {
  setup: 'Setting up',
  open: 'Investing open',
  closed: 'Investing closed',
  revealed: 'Results revealed',
}

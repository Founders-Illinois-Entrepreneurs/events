'use server'

import { revalidatePath } from 'next/cache'
import { getMember, getOrCreateMember } from '@/lib/auth'
import { errorMessage, one, query } from '@/lib/db'
import { getPortfolio } from '@/lib/invest'

// Every action re-checks who this browser belongs to; the SQL functions enforce the game rules.

export type ActionResult = { error?: string }

async function run(fn: (memberId: string) => Promise<unknown>, slug?: string): Promise<ActionResult> {
  const me = await getMember()
  if (!me) return { error: 'Please join the event first (enter your name and pick a team).' }
  try {
    await fn(me.id)
    return {}
  } catch (e) {
    return { error: errorMessage(e) }
  } finally {
    if (slug) revalidatePath(`/invest/${slug}`)
  }
}

// First visit: remembers this browser under the given name, then joins the team.
export async function joinTeam(teamId: string, slug: string, name: string): Promise<ActionResult> {
  try {
    const me = await getOrCreateMember(name)
    await query('select invest_join_team($1, $2)', [me.id, teamId])
    return {}
  } catch (e) {
    return { error: errorMessage(e) }
  } finally {
    revalidatePath(`/invest/${slug}`)
  }
}

export async function leaveTeam(eventId: string, slug: string) {
  return run((m) => query('select invest_leave_team($1, $2)', [m, eventId]), slug)
}

export async function submitPortfolio(teamId: string, slug: string) {
  return run((m) => query('select invest_submit($1, $2)', [m, teamId]), slug)
}

export async function saveAllocation(
  teamId: string,
  presenterId: string,
  draft: { amount: number; rationale: string; invest_more_if: string },
) {
  const amount = Math.max(0, Math.floor(Number(draft.amount) || 0))
  return run((m) =>
    query('select invest_save_allocation($1, $2, $3, $4, $5, $6)', [
      m,
      teamId,
      presenterId,
      amount,
      String(draft.rationale ?? '').slice(0, 5000),
      String(draft.invest_more_if ?? '').slice(0, 5000),
    ]),
  )
}

export async function saveScore(teamId: string, presenterId: string, pillarId: string, score: number) {
  return run((m) => query('select invest_save_score($1, $2, $3, $4, $5)', [m, teamId, presenterId, pillarId, score]))
}

// Teammate sync: the latest saved portfolio for a team you're on.
export async function fetchPortfolio(teamId: string) {
  const me = await getMember()
  if (!me) return null
  const member = await one('select 1 from invest_team_members where investor_team_id = $1 and user_id = $2', [
    teamId,
    me.id,
  ])
  if (!member) return null
  return getPortfolio(teamId)
}

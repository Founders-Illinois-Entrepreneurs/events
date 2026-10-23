'use server'

import { revalidatePath } from 'next/cache'
import { getMember, joinTableAs } from '@/lib/auth'
import { errorMessage, query } from '@/lib/db'

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

// Signs this phone in for a table (first visit: remembers the phone under the table's names).
export async function joinTeam(teamId: string, slug: string, names: string): Promise<ActionResult> {
  try {
    await joinTableAs(String(names ?? ''), String(teamId))
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
  const s = Math.round(Number(score))
  if (!(s >= 1 && s <= 5)) return { error: 'Scores go from 1 to 5.' }
  return run((m) => query('select invest_save_score($1, $2, $3, $4, $5)', [m, teamId, presenterId, pillarId, s]))
}

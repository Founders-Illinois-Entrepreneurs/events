'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminSignIn, adminSignOut, requireAdmin } from '@/lib/auth'
import { errorMessage, one, query } from '@/lib/db'
import { slugify } from '@/lib/format'
import type { EventStatus } from '@/lib/types'

// Every admin action checks requireAdmin() first.
// On failure we go back to the page the form was on and show the message there
// (thrown errors are hidden in production, so admins would never see why).

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? '').trim()
}
// Dollar amounts: "200000", "200,000", "$200,000", "150k". Anything else is rejected.
function dollars(fd: FormData, key: string): number | null {
  const raw = str(fd, key).toLowerCase().replace(/[\s$,]/g, '')
  if (!raw) return null
  const m = raw.match(/^(\d+(?:\.\d+)?)(k|m)?$/)
  if (!m) throw new Error('Capital must be a dollar amount, like 200,000 or 200k.')
  const n = Math.round(parseFloat(m[1]) * (m[2] === 'k' ? 1_000 : m[2] === 'm' ? 1_000_000 : 1))
  if (n <= 0 || n > 1_000_000_000) throw new Error('Capital must be between $1 and $1,000,000,000.')
  return n
}

function int(fd: FormData, key: string, fallback = 0) {
  const n = parseInt(String(fd.get(key) ?? '').replace(/[^0-9-]/g, ''), 10)
  return Number.isFinite(n) ? n : fallback
}
// Textareas arrive with \r\n line endings; rubric lists are stored one item per \n line.
function lines(fd: FormData, key: string) {
  return str(fd, key).replace(/\r\n?/g, '\n')
}
// Pillar weight: 0.5 to 5 in steps of 0.5. Blank or unreadable means 1.
function weight(fd: FormData) {
  const n = parseFloat(str(fd, 'weight'))
  return Number.isFinite(n) ? Math.min(5, Math.max(0.5, Math.round(n * 2) / 2)) : 1
}

async function fail(message: string): Promise<never> {
  const ref = (await headers()).get('referer')
  let path = '/admin'
  try {
    if (ref) path = new URL(ref).pathname
  } catch {}
  redirect(`${path}?error=${encodeURIComponent(message)}`)
}

// Runs a change as an organizer.
async function admin(fn: () => Promise<unknown>, eventId?: string, { cleanUrl = true } = {}) {
  await requireAdmin()
  try {
    await fn()
  } catch (e) {
    await fail(errorMessage(e))
  }
  revalidatePath('/admin')
  if (eventId) revalidatePath(`/admin/invest/${eventId}`)
  // Clear an old error message from the URL once something succeeds.
  const ref = (await headers()).get('referer')
  let clean: string | null = null
  try {
    if (ref?.includes('error=')) clean = new URL(ref).pathname
  } catch {}
  if (clean && cleanUrl) redirect(clean)
}

function track(fd: FormData) {
  return str(fd, 'track') === 'partner' ? 'partner' : 'venture'
}

const STATUSES: EventStatus[] = ['setup', 'open', 'closed', 'revealed']

// ---- Events ---------------------------------------------------------------

export async function createEvent(fd: FormData) {
  const name = str(fd, 'name')
  const slug = slugify(str(fd, 'slug') || name)
  const clone = str(fd, 'clone_from') || null
  let id = ''
  let capital: number | null = null
  try {
    capital = dollars(fd, 'starting_capital')
  } catch (e) {
    return fail(errorMessage(e))
  }
  await admin(async () => {
    const row = await one<{ id: string }>('select invest_create_event($1, $2, $3, $4) as id', [
      name,
      slug,
      capital,
      clone,
    ])
    id = row!.id
  }, undefined, { cleanUrl: false })
  redirect(`/admin/invest/${id}`)
}

export async function updateEvent(fd: FormData) {
  const id = str(fd, 'id')
  await admin(async () => {
    const capital = dollars(fd, 'starting_capital')
    if (capital === null) throw new Error('Enter the capital per table.')
    const ev = await one<{ starting_capital: number; started: boolean }>(
      `select starting_capital, exists (select 1 from invest_allocations where event_id = $1) as started
       from events where id = $1`,
      [id],
    )
    if (ev?.started && ev.starting_capital !== capital) {
      throw new Error('Capital can’t change once tables have started investing.')
    }
    await query('update events set name = $2, starting_capital = $3, reveal_names = $4, archived = $5 where id = $1', [
      id,
      str(fd, 'name'),
      capital,
      fd.get('reveal_names') === 'on',
      fd.get('archived') === 'on',
    ])
  }, id)
}

export async function setStatus(fd: FormData) {
  const id = str(fd, 'id')
  const status = str(fd, 'status') as EventStatus
  if (!STATUSES.includes(status)) return fail('Unknown phase.')
  await admin(
    () =>
      status === 'closed'
        ? query('select invest_close_event($1)', [id]) // also auto-submits complete portfolios
        : query('update events set status = $2 where id = $1', [id, status]),
    id,
  )
}

export async function deleteEvent(fd: FormData) {
  const id = str(fd, 'id')
  await admin(async () => {
    const ev = await one<{ slug: string }>('select slug from events where id = $1', [id])
    if (!ev || str(fd, 'confirm').toLowerCase() !== ev.slug) throw new Error('Type the event slug exactly to delete it.')
    await query('delete from events where id = $1', [id])
  }, undefined, { cleanUrl: false })
  redirect('/admin')
}

// ---- Presenter (R&D) teams -----------------------------------------------

export async function addPresenter(fd: FormData) {
  const eventId = str(fd, 'event_id')
  await admin(
    () =>
      query(
        `insert into invest_presenter_teams (event_id, name, one_liner, track, sort_order)
         values ($1, $2, $3, $4, (select count(*) + 1 from invest_presenter_teams where event_id = $1))`,
        [eventId, str(fd, 'name'), str(fd, 'one_liner'), track(fd)],
      ),
    eventId,
  )
}

export async function updatePresenter(fd: FormData) {
  const eventId = str(fd, 'event_id')
  await admin(
    () =>
      query('update invest_presenter_teams set name = $2, one_liner = $3, sort_order = $4, track = $5 where id = $1', [
        str(fd, 'id'),
        str(fd, 'name'),
        str(fd, 'one_liner'),
        int(fd, 'sort_order'),
        track(fd),
      ]),
    eventId,
  )
}

export async function deletePresenter(fd: FormData) {
  const eventId = str(fd, 'event_id')
  await admin(() => query('delete from invest_presenter_teams where id = $1', [str(fd, 'id')]), eventId)
}

// ---- Investor teams -------------------------------------------------------

// One team name per line, so you can paste a whole list.
export async function addInvestorTeams(fd: FormData) {
  const eventId = str(fd, 'event_id')
  const names = str(fd, 'names')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  if (names.length === 0) return
  await admin(
    () =>
      query(
        `insert into invest_investor_teams (event_id, name)
         select $1, n from unnest($2::text[]) as n
         on conflict (event_id, name) do nothing`,
        [eventId, [...new Set(names)]],
      ),
    eventId,
  )
}

export async function updateInvestorTeam(fd: FormData) {
  const eventId = str(fd, 'event_id')
  await admin(
    () =>
      query('update invest_investor_teams set name = $2 where id = $1', [str(fd, 'id'), str(fd, 'name')]),
    eventId,
  )
}

export async function deleteInvestorTeam(fd: FormData) {
  const eventId = str(fd, 'event_id')
  await admin(() => query('delete from invest_investor_teams where id = $1', [str(fd, 'id')]), eventId)
}

// "Free table": signs the table's phone out so a different phone can sign in.
export async function moveMember(fd: FormData) {
  const eventId = str(fd, 'event_id')
  const userId = str(fd, 'user_id')
  await admin(
    () => query('delete from invest_team_members where event_id = $1 and user_id = $2', [eventId, userId]),
    eventId,
  )
}

export async function unlockSubmission(fd: FormData) {
  const eventId = str(fd, 'event_id')
  await admin(async () => {
    const r = await query(
      `delete from invest_submissions s using invest_investor_teams t, events e
       where s.investor_team_id = $1 and t.id = s.investor_team_id and e.id = t.event_id and e.status = 'open'
       returning s.investor_team_id`,
      [str(fd, 'team_id')],
    )
    if (r.length === 0) throw new Error('Submissions can only be unlocked while investing is open.')
  }, eventId)
}

export async function toggleStar(fd: FormData) {
  const eventId = str(fd, 'event_id')
  await admin(
    () =>
      query('update invest_submissions set starred = $2 where investor_team_id = $1', [
        str(fd, 'team_id'),
        fd.get('starred') === 'true',
      ]),
    eventId,
  )
}

// ---- Rubric ---------------------------------------------------------------

export async function savePillar(fd: FormData) {
  const eventId = str(fd, 'event_id')
  const id = str(fd, 'id')
  const label = str(fd, 'label')
  const values = [
    str(fd, 'prompt'),
    lines(fd, 'strong_signals'),
    lines(fd, 'red_flags'),
    int(fd, 'sort_order'),
    str(fd, 'partner_prompt'),
    lines(fd, 'partner_strong_signals'),
    lines(fd, 'partner_red_flags'),
    lines(fd, 'listen_for'),
    lines(fd, 'weak_signals'),
    lines(fd, 'partial_signals'),
    str(fd, 'note'),
    weight(fd),
    lines(fd, 'partner_listen_for'),
  ]
  await admin(
    () =>
      id
        ? query(
            `update invest_rubric_pillars
             set label = $2, prompt = $3, strong_signals = $4, red_flags = $5, sort_order = $6,
                 partner_prompt = $7, partner_strong_signals = $8, partner_red_flags = $9,
                 listen_for = $10, weak_signals = $11, partial_signals = $12, note = $13, weight = $14,
                 partner_listen_for = $15
             where id = $1`,
            [id, label, ...values],
          )
        : query(
            `insert into invest_rubric_pillars (event_id, key, label, prompt, strong_signals, red_flags, sort_order,
                                                partner_prompt, partner_strong_signals, partner_red_flags,
                                                listen_for, weak_signals, partial_signals, note, weight,
                                                partner_listen_for)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [eventId, slugify(label) || `pillar-${Date.now()}`, label, ...values],
          ),
    eventId,
  )
}

export async function deletePillar(fd: FormData) {
  const eventId = str(fd, 'event_id')
  await admin(() => query('delete from invest_rubric_pillars where id = $1', [str(fd, 'id')]), eventId)
}

// ---- Organizer sign-in ----------------------------------------------------

export async function signInAdmin(fd: FormData) {
  if (!(await adminSignIn(String(fd.get('password') ?? '')))) redirect('/admin/login?error=1')
  redirect('/admin')
}

export async function signOutAdmin() {
  await adminSignOut()
  redirect('/')
}

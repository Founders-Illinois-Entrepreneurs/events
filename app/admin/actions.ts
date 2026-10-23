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
function int(fd: FormData, key: string, fallback = 0) {
  const n = parseInt(String(fd.get(key) ?? '').replace(/[^0-9-]/g, ''), 10)
  return Number.isFinite(n) ? n : fallback
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
async function admin(fn: () => Promise<unknown>, eventId?: string) {
  await requireAdmin()
  try {
    await fn()
  } catch (e) {
    await fail(errorMessage(e))
  }
  revalidatePath('/admin')
  if (eventId) revalidatePath(`/admin/invest/${eventId}`)
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
  await admin(async () => {
    const row = await one<{ id: string }>('select invest_create_event($1, $2, $3, $4) as id', [
      name,
      slug,
      int(fd, 'starting_capital', 200000),
      clone,
    ])
    id = row!.id
  })
  redirect(`/admin/invest/${id}`)
}

export async function updateEvent(fd: FormData) {
  const id = str(fd, 'id')
  await admin(
    () =>
      query('update events set name = $2, starting_capital = $3, reveal_names = $4, archived = $5 where id = $1', [
        id,
        str(fd, 'name'),
        int(fd, 'starting_capital', 200000),
        fd.get('reveal_names') === 'on',
        fd.get('archived') === 'on',
      ]),
    id,
  )
}

export async function setStatus(fd: FormData) {
  const id = str(fd, 'id')
  const status = str(fd, 'status') as EventStatus
  if (!STATUSES.includes(status)) return fail('Unknown phase.')
  await admin(() => query('update events set status = $2 where id = $1', [id, status]), id)
}

export async function deleteEvent(fd: FormData) {
  const id = str(fd, 'id')
  await admin(async () => {
    const ev = await one<{ slug: string }>('select slug from events where id = $1', [id])
    if (!ev || str(fd, 'confirm') !== ev.slug) throw new Error('Type the event slug exactly to delete it.')
    await query('delete from events where id = $1', [id])
  })
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
        `insert into invest_investor_teams (event_id, name, max_members)
         select $1, unnest($2::text[]), $3`,
        [eventId, names, int(fd, 'max_members', 3)],
      ),
    eventId,
  )
}

export async function updateInvestorTeam(fd: FormData) {
  const eventId = str(fd, 'event_id')
  await admin(
    () =>
      query('update invest_investor_teams set name = $2, max_members = $3 where id = $1', [
        str(fd, 'id'),
        str(fd, 'name'),
        int(fd, 'max_members', 3),
      ]),
    eventId,
  )
}

export async function deleteInvestorTeam(fd: FormData) {
  const eventId = str(fd, 'event_id')
  await admin(() => query('delete from invest_investor_teams where id = $1', [str(fd, 'id')]), eventId)
}

export async function moveMember(fd: FormData) {
  const eventId = str(fd, 'event_id')
  const userId = str(fd, 'user_id')
  const to = str(fd, 'to_team')
  if (!to) return
  await admin(
    () =>
      to === '__remove'
        ? query('delete from invest_team_members where event_id = $1 and user_id = $2', [eventId, userId])
        : query('update invest_team_members set investor_team_id = $3 where event_id = $1 and user_id = $2', [
            eventId,
            userId,
            to,
          ]),
    eventId,
  )
}

export async function unlockSubmission(fd: FormData) {
  const eventId = str(fd, 'event_id')
  await admin(() => query('delete from invest_submissions where investor_team_id = $1', [str(fd, 'team_id')]), eventId)
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
    str(fd, 'strong_signals'),
    str(fd, 'red_flags'),
    int(fd, 'sort_order'),
    str(fd, 'partner_prompt'),
    str(fd, 'partner_strong_signals'),
    str(fd, 'partner_red_flags'),
  ]
  await admin(
    () =>
      id
        ? query(
            `update invest_rubric_pillars
             set label = $2, prompt = $3, strong_signals = $4, red_flags = $5, sort_order = $6,
                 partner_prompt = $7, partner_strong_signals = $8, partner_red_flags = $9
             where id = $1`,
            [id, label, ...values],
          )
        : query(
            `insert into invest_rubric_pillars (event_id, key, label, prompt, strong_signals, red_flags, sort_order,
                                                partner_prompt, partner_strong_signals, partner_red_flags)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
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

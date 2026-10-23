import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { one, query } from '@/lib/db'
import { money } from '@/lib/format'
import { STATUS_LABEL, TRACK_LABEL } from '@/lib/types'
import type {
  Allocation,
  ClubEvent,
  EventStatus,
  InvestorTeam,
  Pillar,
  PresenterTeam,
  RubricScore,
  Track,
} from '@/lib/types'
import StatusChip from '@/components/StatusChip'
import ConfirmButton from '@/components/ConfirmButton'
import ErrorBanner from '@/components/ErrorBanner'
import AutoRefresh from '@/components/AutoRefresh'
import {
  addInvestorTeams,
  addPresenter,
  deleteEvent,
  deleteInvestorTeam,
  deletePillar,
  deletePresenter,
  moveMember,
  savePillar,
  setStatus,
  toggleStar,
  unlockSubmission,
  updateEvent,
  updateInvestorTeam,
  updatePresenter,
} from '../../actions'

type Member = { user_id: string; investor_team_id: string; name: string; joined_at: string }
type Submission = { investor_team_id: string; submitted_at: string; starred: boolean }

const PHASES: { status: EventStatus; label: string; help: string; confirm?: string }[] = [
  { status: 'setup', label: 'Setup', help: 'Members can join teams and read the rubric.' },
  {
    status: 'open',
    label: 'Open investing',
    help: 'Members fill in and submit portfolios.',
    confirm: 'Open investing now? Members will see the form immediately.',
  },
  {
    status: 'closed',
    label: 'Close investing',
    help: 'No more edits or submissions. Unsubmitted teams don’t count.',
    confirm: 'Close investing? Teams that haven’t submitted won’t count.',
  },
  {
    status: 'revealed',
    label: 'Reveal results',
    help: 'Everyone can see results and feedback.',
    confirm: 'Reveal results to everyone?',
  },
]

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const event = await one<{ name: string }>('select name from events where id::text = $1', [(await params).id])
  return { title: event ? `Admin · ${event.name}` : 'Admin' }
}

export default async function AdminEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const { error } = await searchParams
  const event = await one<ClubEvent>('select * from events where id::text = $1', [id])
  if (!event) notFound()

  const [presenters, investors, members, allocations, scores, submissions, pillars] = await Promise.all([
    query<PresenterTeam>('select * from invest_presenter_teams where event_id = $1 order by sort_order, name', [id]),
    query<InvestorTeam>('select * from invest_investor_teams where event_id = $1 order by name', [id]),
    query<Member>(
      `select m.user_id, m.investor_team_id, mb.name, m.joined_at
       from invest_team_members m join members mb on mb.id = m.user_id
       where m.event_id = $1 order by m.joined_at`,
      [id],
    ),
    query<Allocation>('select * from invest_allocations where event_id = $1', [id]),
    query<Pick<RubricScore, 'investor_team_id' | 'presenter_team_id' | 'pillar_id'>>(
      'select investor_team_id, presenter_team_id, pillar_id from invest_rubric_scores where event_id = $1',
      [id],
    ),
    query<Submission>('select investor_team_id, submitted_at, starred from invest_submissions where event_id = $1', [id]),
    query<Pillar>('select * from invest_rubric_pillars where event_id = $1 order by sort_order, label', [id]),
  ])

  const submittedCount = submissions.length
  const runningTotals = presenters.map((p) => ({
    ...p,
    total: allocations
      .filter((a) => a.presenter_team_id === p.id && submissions.some((s) => s.investor_team_id === a.investor_team_id))
      .reduce((sum, a) => sum + a.amount, 0),
  }))
  const membersTotal = members.length

  return (
    <div className="space-y-12">
      {/* Live tracker: refresh while members are joining or investing. */}
      {(event.status === 'setup' || event.status === 'open') && <AutoRefresh seconds={5} />}

      <header className="space-y-3">
        <Link href="/admin" className="mono text-sm underline">
          ← All events
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-5xl sm:text-6xl">{event.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusChip status={event.status} />
              <span className="chip chip-muted">{money(event.starting_capital)} per team</span>
              {event.archived && <span className="chip chip-muted">Archived</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/invest/${event.slug}`} className="btn btn-ghost btn-sm">
              Member view
            </Link>
            <Link href={`/admin/invest/${id}/present`} className="btn btn-ghost btn-sm">
              Projector reveal
            </Link>
            <Link href={`/admin/invest/${id}/feedback`} className="btn btn-ghost btn-sm">
              Feedback report
            </Link>
          </div>
        </div>
        <p className="mono text-sm text-ink-2">
          Members join at: <strong>/invest/{event.slug}</strong>
        </p>
      </header>

      <ErrorBanner error={error} />

      {/* Phase control */}
      <section className="space-y-4">
        <h2 className="display text-4xl">Phase</h2>
        <div className="grid gap-3 md:grid-cols-4">
          {PHASES.map((ph, i) => {
            const current = ph.status === event.status
            return (
              <form key={ph.status} action={setStatus} className={`card ${current ? 'card-shadow bg-orange-soft' : ''}`}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="status" value={ph.status} />
                <p className="mono text-xs text-ink-3">Step {i + 1}</p>
                <p className="display mt-1 text-2xl">{STATUS_LABEL[ph.status]}</p>
                <p className="mt-1 min-h-10 text-xs text-ink-2">{ph.help}</p>
                {current ? (
                  <span className="chip chip-orange mt-3">Current</span>
                ) : (
                  <ConfirmButton message={ph.confirm} className="btn btn-primary btn-sm mt-3">
                    {ph.label}
                  </ConfirmButton>
                )}
              </form>
            )
          })}
        </div>
        {presenters.length === 0 && <p className="alert alert-warn">Add the R&amp;D teams below before opening.</p>}
        {investors.length === 0 && <p className="alert alert-warn">Add investor teams below so members can join.</p>}
      </section>

      {/* Live tracker */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-4xl">Live tracker</h2>
          <p className="mono text-sm">
            {submittedCount}/{investors.length} teams submitted · {membersTotal} members joined
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {runningTotals.map((p) => (
            <div key={p.id} className="card">
              <p className="eyebrow">{p.name}</p>
              <p className="num text-4xl">{money(p.total)}</p>
              <p className="mono text-xs text-ink-3">from submitted teams · admins only until reveal</p>
            </div>
          ))}
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Investor team</th>
                <th>Members</th>
                <th>Progress</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {investors.map((t) => {
                const tm = members.filter((m) => m.investor_team_id === t.id)
                const ta = allocations.filter((a) => a.investor_team_id === t.id)
                const allocated = ta.reduce((s, a) => s + a.amount, 0)
                const doneCards = presenters.filter((p) => {
                  const a = ta.find((x) => x.presenter_team_id === p.id)
                  const n = scores.filter((s) => s.investor_team_id === t.id && s.presenter_team_id === p.id).length
                  return a && a.rationale.trim() && a.invest_more_if.trim() && n >= pillars.length
                }).length
                const sub = submissions.find((s) => s.investor_team_id === t.id)
                return (
                  <tr key={t.id}>
                    <td className="font-semibold">{t.name}</td>
                    <td className="text-sm">
                      {tm.length === 0 ? <span className="text-ink-3">–</span> : tm.map((m) => m.name).join(', ')}
                    </td>
                    <td className="mono text-xs">
                      {money(allocated)} / {money(event.starting_capital)}
                      <br />
                      {doneCards}/{presenters.length} teams complete
                    </td>
                    <td>
                      {sub ? (
                        <span className="chip chip-green">
                          Submitted {new Date(sub.submitted_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="chip chip-muted">Working</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {sub && (
                        <div className="flex justify-end gap-2">
                          <form action={toggleStar}>
                            <input type="hidden" name="event_id" value={id} />
                            <input type="hidden" name="team_id" value={t.id} />
                            <input type="hidden" name="starred" value={String(!sub.starred)} />
                            <ConfirmButton className={`btn btn-sm ${sub.starred ? 'btn-orange' : 'btn-ghost'}`}>
                              {sub.starred ? '★ Best thesis' : '☆ Star'}
                            </ConfirmButton>
                          </form>
                          <form action={unlockSubmission}>
                            <input type="hidden" name="event_id" value={id} />
                            <input type="hidden" name="team_id" value={t.id} />
                            <ConfirmButton message={`Unlock ${t.name}'s portfolio so they can edit it?`} className="btn btn-ghost btn-sm">
                              Unlock
                            </ConfirmButton>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* R&D (presenter) teams */}
      <section className="space-y-4">
        <h2 className="display text-4xl">R&amp;D teams (presenting)</h2>
        <div className="space-y-3">
          {presenters.map((p) => (
            <div key={p.id} className="card flex flex-col gap-3 md:flex-row md:items-end">
              <form action={updatePresenter} className="grid flex-1 gap-3 md:grid-cols-[80px_1fr_160px_2fr_auto] md:items-end">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="event_id" value={id} />
                <div>
                  <label className="field-label">Order</label>
                  <input name="sort_order" className="input mono" defaultValue={p.sort_order} inputMode="numeric" />
                </div>
                <div>
                  <label className="field-label">Name</label>
                  <input name="name" className="input" defaultValue={p.name} required />
                </div>
                <TrackSelect value={p.track} />
                <div>
                  <label className="field-label">One-liner</label>
                  <input name="one_liner" className="input" defaultValue={p.one_liner} />
                </div>
                <ConfirmButton className="btn btn-primary btn-sm">Save</ConfirmButton>
              </form>
              <form action={deletePresenter}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="event_id" value={id} />
                <ConfirmButton message={`Delete ${p.name}? Any investments in it are deleted too.`} className="btn btn-danger btn-sm">
                  Delete
                </ConfirmButton>
              </form>
            </div>
          ))}
          <form action={addPresenter} className="card card-muted grid gap-3 md:grid-cols-[1fr_160px_2fr_auto] md:items-end">
            <input type="hidden" name="event_id" value={id} />
            <div>
              <label className="field-label">New R&amp;D team</label>
              <input name="name" className="input" placeholder="Team name" required />
            </div>
            <TrackSelect value="venture" />
            <div>
              <label className="field-label">One-liner</label>
              <input name="one_liner" className="input" placeholder="What they're building, in one line" />
            </div>
            <button className="btn btn-orange btn-sm">Add</button>
          </form>
        </div>
        <p className="text-xs text-ink-3">
          <strong>Own venture</strong>: building their own startup. <strong>Startup partner</strong>: working with an existing
          startup (consulting, contracting, mentorship). Both are scored on the same pillars; partner teams see questions
          reworded for their situation.
        </p>
      </section>

      {/* Investor teams */}
      <section className="space-y-4">
        <h2 className="display text-4xl">Investor teams</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {investors.map((t) => {
            const tm = members.filter((m) => m.investor_team_id === t.id)
            return (
              <div key={t.id} className="card space-y-3">
                <form action={updateInvestorTeam} className="grid grid-cols-[1fr_90px_auto] items-end gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="event_id" value={id} />
                  <div>
                    <label className="field-label">Name</label>
                    <input name="name" className="input" defaultValue={t.name} required />
                  </div>
                  <div>
                    <label className="field-label">Max</label>
                    <input name="max_members" className="input mono" defaultValue={t.max_members} inputMode="numeric" />
                  </div>
                  <ConfirmButton className="btn btn-primary btn-sm">Save</ConfirmButton>
                </form>
                <ul className="space-y-2">
                  {tm.length === 0 && <li className="text-sm text-ink-3">No members yet.</li>}
                  {tm.map((m) => (
                    <li key={m.user_id}>
                      <form action={moveMember} className="flex items-center justify-between gap-2">
                        <input type="hidden" name="event_id" value={id} />
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <span className="min-w-0 truncate text-sm">
                          {m.name}{' '}
                          <span className="mono text-xs text-ink-3">
                            joined {new Date(m.joined_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </span>
                        <span className="flex gap-1">
                          <select name="to_team" className="input h-8 min-h-0 w-36 py-0 text-xs" defaultValue="">
                            <option value="" disabled>
                              Move to…
                            </option>
                            {investors
                              .filter((o) => o.id !== t.id)
                              .map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            <option value="__remove">Remove from event</option>
                          </select>
                          <ConfirmButton className="btn btn-ghost btn-sm">Go</ConfirmButton>
                        </span>
                      </form>
                    </li>
                  ))}
                </ul>
                <form action={deleteInvestorTeam} className="text-right">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="event_id" value={id} />
                  <ConfirmButton message={`Delete ${t.name} and its portfolio?`} className="btn btn-danger btn-sm">
                    Delete team
                  </ConfirmButton>
                </form>
              </div>
            )
          })}
        </div>
        <form action={addInvestorTeams} className="card card-muted grid gap-3 md:grid-cols-[1fr_120px_auto] md:items-end">
          <input type="hidden" name="event_id" value={id} />
          <div>
            <label className="field-label">Add investor teams (one name per line)</label>
            <textarea name="names" className="input" placeholder={'Table 1\nTable 2\nTable 3'} required />
          </div>
          <div>
            <label className="field-label">Max members</label>
            <input name="max_members" className="input mono" defaultValue="3" inputMode="numeric" />
          </div>
          <button className="btn btn-orange btn-sm">Add teams</button>
        </form>
      </section>

      {/* Rubric */}
      <section className="space-y-4">
        <div>
          <h2 className="display text-4xl">Rubric</h2>
          <p className="text-sm text-ink-2">
            These pillars are the lesson. Members see them on the &ldquo;What investors look for&rdquo; page and score every
            team on each one. Keep the <span className="mono">honesty</span> pillar: its average is shown on the reveal.
          </p>
        </div>
        <div className="space-y-3">
          {pillars.map((p) => (
            <PillarForm key={p.id} eventId={id} p={p} />
          ))}
          <details className="card card-muted">
            <summary className="cursor-pointer font-semibold">+ Add a pillar</summary>
            <div className="mt-3">
              <PillarForm eventId={id} />
            </div>
          </details>
        </div>
      </section>

      {/* Settings */}
      <section className="grid gap-6 md:grid-cols-2">
        <form action={updateEvent} className="card space-y-4">
          <h2 className="display text-3xl">Settings</h2>
          <input type="hidden" name="id" value={id} />
          <div>
            <label className="field-label">Name</label>
            <input name="name" className="input" defaultValue={event.name} required />
          </div>
          <div>
            <label className="field-label">Capital per investor team ($)</label>
            <input name="starting_capital" className="input mono" defaultValue={event.starting_capital} inputMode="numeric" />
            <p className="mt-1 text-xs text-ink-3">Change this before anyone starts investing.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="reveal_names" defaultChecked={event.reveal_names} />
            Show investor team names next to their feedback
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="archived" defaultChecked={event.archived} />
            Archived (hidden from the home page, kept for history)
          </label>
          <ConfirmButton className="btn btn-primary">Save settings</ConfirmButton>
        </form>

        <form action={deleteEvent} className="card space-y-4 border-red">
          <h2 className="display text-3xl text-red">Delete event</h2>
          <p className="text-sm text-ink-2">
            Permanently deletes this event and everything in it. To keep it for later, archive it instead.
          </p>
          <input type="hidden" name="id" value={id} />
          <div>
            <label className="field-label">Type the slug to confirm: {event.slug}</label>
            <input name="confirm" className="input mono" autoComplete="off" />
          </div>
          <ConfirmButton message="Delete this event forever?" className="btn btn-danger">
            Delete forever
          </ConfirmButton>
        </form>
      </section>
    </div>
  )
}

function TrackSelect({ value }: { value: Track }) {
  return (
    <div>
      <label className="field-label">Track</label>
      <select name="track" className="input" defaultValue={value}>
        <option value="venture">{TRACK_LABEL.venture}</option>
        <option value="partner">{TRACK_LABEL.partner}</option>
      </select>
    </div>
  )
}

function PillarForm({ eventId, p }: { eventId: string; p?: Pillar }) {
  return (
    <div className={p ? 'card' : ''}>
      <form action={savePillar} className="grid gap-3 md:grid-cols-[70px_1fr_2fr]">
        <input type="hidden" name="event_id" value={eventId} />
        {p && <input type="hidden" name="id" value={p.id} />}
        <div>
          <label className="field-label">Order</label>
          <input name="sort_order" className="input mono" defaultValue={p?.sort_order ?? 99} inputMode="numeric" />
        </div>
        <div>
          <label className="field-label">
            Pillar {p && <span className="text-ink-3 normal-case">({p.key})</span>}
          </label>
          <input name="label" className="input" defaultValue={p?.label} required />
        </div>
        <div>
          <label className="field-label">Question</label>
          <input name="prompt" className="input" defaultValue={p?.prompt} />
        </div>
        <div className="md:col-span-3 grid gap-3 md:grid-cols-2">
          <div>
            <label className="field-label text-green">Strong looks like</label>
            <textarea name="strong_signals" className="input" defaultValue={p?.strong_signals} />
          </div>
          <div>
            <label className="field-label text-red">Red flags</label>
            <textarea name="red_flags" className="input" defaultValue={p?.red_flags} />
          </div>
        </div>
        <details className="md:col-span-3 rounded-[6px] border-2 border-blue-2 bg-blue-soft p-3" open={!!p?.partner_prompt}>
          <summary className="cursor-pointer text-sm font-semibold text-blue">
            Wording for startup-partner teams (optional)
          </summary>
          <div className="mt-3 grid gap-3">
            <div>
              <label className="field-label">Question</label>
              <input name="partner_prompt" className="input" defaultValue={p?.partner_prompt} placeholder="Leave blank to use the main question" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="field-label text-green">Strong looks like</label>
                <textarea name="partner_strong_signals" className="input" defaultValue={p?.partner_strong_signals} />
              </div>
              <div>
                <label className="field-label text-red">Red flags</label>
                <textarea name="partner_red_flags" className="input" defaultValue={p?.partner_red_flags} />
              </div>
            </div>
          </div>
        </details>
        <div className="md:col-span-3 flex justify-end gap-2">
          <ConfirmButton className="btn btn-primary btn-sm">{p ? 'Save pillar' : 'Add pillar'}</ConfirmButton>
        </div>
      </form>
      {p && (
        <form action={deletePillar} className="mt-2 text-right">
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="event_id" value={eventId} />
          <ConfirmButton message={`Delete the ${p.label} pillar and its scores?`} className="btn btn-danger btn-sm">
            Delete pillar
          </ConfirmButton>
        </form>
      )}
    </div>
  )
}

import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { one, query } from '@/lib/db'
import { money, timeOfDay } from '@/lib/format'
import { hasScoreGuide } from '@/lib/rubric'
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
  resetEvent,
  deleteInvestorTeam,
  deletePillar,
  resetRubric,
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
type Submission = { investor_team_id: string; submitted_at: string; starred: boolean; submitted_by: string | null }

const PHASES: { status: EventStatus; label: string; help: string; confirm?: string }[] = [
  { status: 'setup', label: 'Setup', help: 'Members can join teams and read the rubric.' },
  {
    status: 'open',
    label: 'Open investing',
    help: 'Tables score each team as it pitches, then split the money and submit.',
    confirm: 'Open investing now? Do this as the first pitch starts, so tables can score as they go.',
  },
  {
    status: 'closed',
    label: 'Close investing',
    help: 'No more edits. Complete portfolios are submitted automatically; incomplete ones don’t count.',
    confirm:
      'Close investing? Tables with a complete portfolio are submitted automatically. Incomplete ones won’t count.',
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
  const h = await headers()
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host') ?? ''}`
  const event = await one<ClubEvent>('select * from events where id::text = $1', [id])
  if (!event) notFound()

  const [presenters, investors, members, allocations, scores, submissions, pillars] = await Promise.all([
    query<PresenterTeam>('select * from invest_presenter_teams where event_id = $1 order by sort_order, name', [id]),
    query<InvestorTeam>('select * from invest_investor_teams where event_id = $1 order by length(name), name', [id]),
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
    query<Submission>('select investor_team_id, submitted_at, starred, submitted_by from invest_submissions where event_id = $1', [id]),
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
              <span className="chip chip-muted">{money(event.starting_capital)} per table</span>
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
          Members join at: <strong className="break-all">{origin}/invest/{event.slug}</strong>
        </p>
      </header>

      <ErrorBanner error={error} />

      {/* Phase control */}
      <section className="space-y-4">
        <h2 className="display text-4xl">Phase</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {PHASES.map((ph, i) => {
            const current = ph.status === event.status
            const backwards = i < PHASES.findIndex((x) => x.status === event.status)
            const message = backwards
              ? `Go BACK to "${STATUS_LABEL[ph.status]}"? This is unusual; members' screens will change.`
              : ph.confirm
            return (
              <form key={ph.status} action={setStatus} className={`card p-3 sm:p-[22px] ${current ? 'card-shadow bg-orange-soft' : ''}`}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="status" value={ph.status} />
                <p className="mono text-xs text-ink-3">Step {i + 1}</p>
                <p className="display mt-1 text-2xl">{STATUS_LABEL[ph.status]}</p>
                <p className="mt-1 hidden min-h-10 text-xs text-ink-2 sm:block">{ph.help}</p>
                {current ? (
                  <span className="chip chip-orange mt-3">Current</span>
                ) : (
                  <ConfirmButton message={message} className={`btn btn-sm mt-3 ${backwards ? 'btn-ghost' : 'btn-primary'}`}>
                    {backwards ? `Back to ${ph.label.toLowerCase()}` : ph.label}
                  </ConfirmButton>
                )}
              </form>
            )
          })}
        </div>
        {event.status === 'closed' && (
          <p className="alert alert-info">
            Tip: open the <strong>Projector reveal</strong> and step through it <em>before</em> pressing Reveal results.
            Phones show the results within seconds of revealing.
          </p>
        )}
        {presenters.length === 0 && <p className="alert alert-warn">Add the R&amp;D teams below before opening.</p>}
        {investors.length === 0 && <p className="alert alert-warn">Add investor tables below so members can join.</p>}
      </section>

      {/* Live tracker */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-4xl">Live tracker</h2>
          <p className="mono text-sm">
            {submittedCount}/{investors.length} tables submitted · {membersTotal} signed in
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {runningTotals.map((p) => (
            <div key={p.id} className="card p-3 sm:p-[22px]">
              <p className="eyebrow truncate">{p.name}</p>
              <p className="num text-2xl sm:text-4xl">{money(p.total)}</p>
              <p className="mono hidden text-xs text-ink-3 sm:block">from submitted tables · organizers only until reveal</p>
            </div>
          ))}
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Table</th>
                <th>Who&apos;s there</th>
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
                          {sub.submitted_by ? 'Submitted' : 'Auto-submitted'}{' '}
                          {timeOfDay(sub.submitted_at)}
                        </span>
                      ) : (
                        <span className="chip chip-muted">Working</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {!sub && tm.length > 0 && (event.status === 'setup' || event.status === 'open') && (
                        <form action={moveMember} className="flex justify-end">
                          <input type="hidden" name="event_id" value={id} />
                          <input type="hidden" name="user_id" value={tm[0].user_id} />
                          <input type="hidden" name="to_team" value="__remove" />
                          <ConfirmButton
                            message={`Free ${t.name}? The phone signed in now is signed out, and another phone can sign in. Answers so far are kept.`}
                            className="btn btn-ghost btn-sm"
                          >
                            Free table
                          </ConfirmButton>
                        </form>
                      )}
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
                          {event.status === 'open' && (
                            <form action={unlockSubmission}>
                              <input type="hidden" name="event_id" value={id} />
                              <input type="hidden" name="team_id" value={t.id} />
                              <ConfirmButton
                                message={`Unlock ${t.name}'s portfolio so they can edit it? They'll need to submit again.`}
                                className="btn btn-ghost btn-sm"
                              >
                                Unlock
                              </ConfirmButton>
                            </form>
                          )}
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

      {/* Investor tables */}
      <section className="space-y-4">
        <div>
          <h2 className="display text-4xl">Investor tables</h2>
          <p className="text-sm text-ink-2">One phone signs in per table. To let a different phone take over, use “Free table” in the tracker.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {investors.map((t) => (
            <div key={t.id} className="card flex items-end gap-2 p-3">
              <form action={updateInvestorTeam} className="flex flex-1 items-end gap-2">
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="event_id" value={id} />
                <div className="flex-1">
                  <label className="field-label">Name</label>
                  <input name="name" className="input" defaultValue={t.name} required />
                </div>
                <ConfirmButton className="btn btn-primary btn-sm">Save</ConfirmButton>
              </form>
              <form action={deleteInvestorTeam}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="event_id" value={id} />
                <ConfirmButton message={`Delete ${t.name} and its portfolio?`} className="btn btn-danger btn-sm">
                  Delete
                </ConfirmButton>
              </form>
            </div>
          ))}
        </div>
        <form action={addInvestorTeams} className="card card-muted grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <input type="hidden" name="event_id" value={id} />
          <div>
            <label className="field-label">Add tables (one name per line)</label>
            <textarea name="names" className="input" placeholder={'Table 1\nTable 2\nTable 3'} required />
          </div>
          <button className="btn btn-orange btn-sm">Add tables</button>
        </form>
      </section>

      {/* Rubric */}
      <section className="space-y-4">
        <div>
          <h2 className="display text-4xl">Rubric</h2>
          <p className="text-sm text-ink-2">
            These pillars are the lesson. Members see them on the &ldquo;What investors look for&rdquo; page and score every
            team on each one. A team&apos;s rubric score is the weighted average of its pillar scores: it breaks ties and
            suggests how each table splits its money. Put each checklist item and red flag on its own line.
          </p>
          {scores.length === 0 && event.status === 'setup' && (
            <form action={resetRubric} className="mt-3 flex flex-wrap items-center gap-3">
              <input type="hidden" name="event_id" value={id} />
              <ConfirmButton
                message="Replace this event's rubric with the latest default (checklists, 1/3/5 score guides, weights)? Any edits you made to these pillars are lost."
                className="btn btn-ghost btn-sm"
              >
                Use the latest default rubric
              </ConfirmButton>
              {!pillars.some((pl) => hasScoreGuide(pl)) && (
                <span className="text-xs font-semibold text-orange-ink">
                  This event uses the older rubric (no score guides or weights).
                </span>
              )}
            </form>
          )}
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
            <label className="field-label">Capital per table ($)</label>
            <input
              name="starting_capital"
              className="input mono"
              defaultValue={event.starting_capital}
              inputMode="numeric"
              readOnly={allocations.length > 0}
            />
            <p className="mt-1 text-xs text-ink-3">
              {allocations.length > 0 ? 'Locked: tables have already started investing.' : 'Set this before investing opens.'}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="reveal_names" defaultChecked={event.reveal_names} />
            Show table names next to their feedback
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="archived" defaultChecked={event.archived} />
            Archived (hidden from the home page, kept for history)
          </label>
          <ConfirmButton className="btn btn-primary">Save settings</ConfirmButton>
        </form>

        <form action={resetEvent} className="card space-y-4 border-orange-ink">
          <h2 className="display text-3xl text-orange-ink">Reset event</h2>
          <p className="text-sm text-ink-2">
            A fresh restart, e.g. after a practice run. Signs every phone out and deletes all answers, scores, submissions
            and stars, restores the default rubric, and goes back to Setup. Keeps the name, link, capital, R&amp;D teams
            and tables.
          </p>
          <input type="hidden" name="id" value={id} />
          <div>
            <label className="field-label">
              Type the slug to confirm: <span className="mono normal-case">{event.slug}</span>
            </label>
            <input name="confirm" className="input mono" autoComplete="off" />
          </div>
          <ConfirmButton message="Reset this event? Everything tables entered is deleted. This can't be undone." className="btn btn-danger">
            Reset to a fresh start
          </ConfirmButton>
        </form>

        <form action={deleteEvent} className="card space-y-4 border-red">
          <h2 className="display text-3xl text-red">Delete event</h2>
          <p className="text-sm text-ink-2">
            Permanently deletes this event and everything in it. To keep it for later, archive it instead.
          </p>
          <input type="hidden" name="id" value={id} />
          <div>
            <label className="field-label">
              Type the slug to confirm: <span className="mono normal-case">{event.slug}</span>
            </label>
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
        <div className="md:col-span-3 grid gap-3 md:grid-cols-[110px_1fr]">
          <div>
            <label className="field-label">Weight</label>
            <input
              name="weight"
              type="number"
              min={0.5}
              max={5}
              step={0.5}
              className="input mono"
              defaultValue={p?.weight ?? 1}
              title="1 = counts once, 1.5 = counts extra, 0.5 = counts half"
            />
          </div>
          <div>
            <label className="field-label">Note (optional)</label>
            <input name="note" className="input" defaultValue={p?.note} placeholder="Shown under the question, e.g. why this pillar counts half" />
          </div>
        </div>
        <div className="md:col-span-3 grid gap-3 md:grid-cols-2">
          <div>
            <label className="field-label">Listen for · one per line</label>
            <textarea name="listen_for" className="input" rows={4} defaultValue={p?.listen_for} />
          </div>
          <div>
            <label className="field-label text-red">Red flags · one per line</label>
            <textarea name="red_flags" className="input" rows={4} defaultValue={p?.red_flags} />
          </div>
        </div>
        <div className="md:col-span-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className="field-label text-red">Score guide · 1 Missing</label>
            <textarea name="weak_signals" className="input" defaultValue={p?.weak_signals} />
          </div>
          <div>
            <label className="field-label">Score guide · 3 Partial</label>
            <textarea name="partial_signals" className="input" defaultValue={p?.partial_signals} />
          </div>
          <div>
            <label className="field-label text-green">Score guide · 5 Convincing</label>
            <textarea name="strong_signals" className="input" defaultValue={p?.strong_signals} />
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
            <div>
              <label className="field-label">Listen for · one per line</label>
              <textarea name="partner_listen_for" className="input" rows={3} defaultValue={p?.partner_listen_for} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="field-label">Score guide · 1</label>
                <textarea name="partner_weak_signals" className="input" defaultValue={p?.partner_weak_signals} />
              </div>
              <div>
                <label className="field-label">Score guide · 3</label>
                <textarea name="partner_partial_signals" className="input" defaultValue={p?.partner_partial_signals} />
              </div>
              <div>
                <label className="field-label text-green">Score guide · 5 / strong</label>
                <textarea name="partner_strong_signals" className="input" defaultValue={p?.partner_strong_signals} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
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
